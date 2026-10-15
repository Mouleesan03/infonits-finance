<?php
/**
 * Plugin Name: Infonits Site Agent
 * Description: Read-only WordPress health reporting for Infonits Website Care.
 * Version: 1.2.0
 * Author: Infonits
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('INFONITS_SITE_AGENT_VERSION', '1.2.0');
define('INFONITS_SITE_AGENT_CRON', 'infonits_site_agent_hourly');

function infonits_site_agent_health() {
    if (!function_exists('wp_get_update_data')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }
    $updates = wp_get_update_data();
    $theme = wp_get_theme();

    return array(
        'agentVersion' => INFONITS_SITE_AGENT_VERSION,
        'wordpressVersion' => get_bloginfo('version'),
        'phpVersion' => PHP_VERSION,
        'activeTheme' => $theme->get('Name') . ' ' . $theme->get('Version'),
        'pluginUpdates' => isset($updates['counts']['plugins']) ? (int) $updates['counts']['plugins'] : 0,
        'themeUpdates' => isset($updates['counts']['themes']) ? (int) $updates['counts']['themes'] : 0,
        'debugEnabled' => defined('WP_DEBUG') && WP_DEBUG,
        'httpsEnabled' => is_ssl(),
    );
}

function infonits_site_agent_token() {
    return trim((string) get_option('infonits_site_agent_token', ''));
}

function infonits_site_agent_authorized($request) {
    $expected = infonits_site_agent_token();
    $header = (string) $request->get_header('authorization');
    $supplied = preg_replace('/^Bearer\s+/i', '', $header);
    return $expected !== '' && is_string($supplied) && hash_equals($expected, $supplied);
}

function infonits_site_agent_register_rest() {
    register_rest_route('infonits-site-agent/v1', '/health', array(
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => 'infonits_site_agent_authorized',
        'callback' => function () {
            return rest_ensure_response(array(
                'siteUrl' => home_url('/'),
                'health' => infonits_site_agent_health(),
                'generatedAt' => gmdate('c'),
            ));
        },
    ));
}
add_action('rest_api_init', 'infonits_site_agent_register_rest');

function infonits_site_agent_send_health() {
    $app_url = untrailingslashit((string) get_option('infonits_site_agent_app_url', ''));
    $site_id = trim((string) get_option('infonits_site_agent_site_id', ''));
    $token = infonits_site_agent_token();
    $missing = array();
    if ($app_url === '') {
        $missing[] = 'Website Care URL';
    }
    if ($site_id === '') {
        $missing[] = 'Site ID';
    }
    if ($token === '') {
        $missing[] = 'Agent token';
    }
    if (!empty($missing)) {
        $error = 'Connection is incomplete. Missing: ' . implode(', ', $missing) . '.';
        update_option('infonits_site_agent_last_error', $error, false);
        return new WP_Error('infonits_not_connected', $error);
    }

    $response = wp_remote_post($app_url . '/api/website-care/heartbeat', array(
        'timeout' => 15,
        'redirection' => 0,
        'headers' => array(
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
        ),
        'body' => wp_json_encode(array(
            'siteId' => $site_id,
            'siteUrl' => home_url('/'),
            'health' => infonits_site_agent_health(),
        )),
    ));
    if (is_wp_error($response)) {
        update_option('infonits_site_agent_last_error', $response->get_error_message(), false);
        return $response;
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code < 200 || $code >= 300) {
        $body = json_decode(wp_remote_retrieve_body($response), true);
        $detail = is_array($body) && isset($body['error']) ? sanitize_text_field((string) $body['error']) : '';
        $error = 'Website Care returned HTTP ' . $code . ($detail !== '' ? ': ' . $detail : '.');
        update_option('infonits_site_agent_last_error', $error, false);
        return new WP_Error('infonits_agent_http', $error);
    }
    update_option('infonits_site_agent_last_sent', gmdate('c'), false);
    delete_option('infonits_site_agent_last_error');
    return true;
}
add_action(INFONITS_SITE_AGENT_CRON, 'infonits_site_agent_send_health');

function infonits_site_agent_activate() {
    if (!wp_next_scheduled(INFONITS_SITE_AGENT_CRON)) {
        wp_schedule_event(time() + 60, 'hourly', INFONITS_SITE_AGENT_CRON);
    }
}
register_activation_hook(__FILE__, 'infonits_site_agent_activate');

function infonits_site_agent_deactivate() {
    wp_clear_scheduled_hook(INFONITS_SITE_AGENT_CRON);
}
register_deactivation_hook(__FILE__, 'infonits_site_agent_deactivate');

function infonits_site_agent_admin_menu() {
    add_options_page(
        'Infonits Site Agent',
        'Infonits Site Agent',
        'manage_options',
        'infonits-site-agent',
        'infonits_site_agent_settings_page'
    );
}
add_action('admin_menu', 'infonits_site_agent_admin_menu');

function infonits_site_agent_admin_init() {
    register_setting('infonits_site_agent', 'infonits_site_agent_app_url', array(
        'sanitize_callback' => 'esc_url_raw',
        'default' => 'https://infonits-finance.vercel.app',
    ));
    register_setting('infonits_site_agent', 'infonits_site_agent_site_id', array(
        'sanitize_callback' => 'sanitize_text_field',
        'default' => '',
    ));
    register_setting('infonits_site_agent', 'infonits_site_agent_token', array(
        'sanitize_callback' => 'sanitize_text_field',
        'default' => '',
    ));
}
add_action('admin_init', 'infonits_site_agent_admin_init');

function infonits_site_agent_handle_send() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('You are not allowed to do this.', 'infonits-site-agent'));
    }
    check_admin_referer('infonits_site_agent_send');
    $result = infonits_site_agent_send_health();
    $status = is_wp_error($result) ? 'error' : 'sent';
    wp_safe_redirect(add_query_arg(array('page' => 'infonits-site-agent', 'agent_status' => $status), admin_url('options-general.php')));
    exit;
}
add_action('admin_post_infonits_site_agent_send', 'infonits_site_agent_handle_send');

function infonits_site_agent_handle_save_test() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('You are not allowed to do this.', 'infonits-site-agent'));
    }
    check_admin_referer('infonits_site_agent_save_test');
    $app_url = isset($_POST['infonits_site_agent_app_url'])
        ? esc_url_raw(wp_unslash($_POST['infonits_site_agent_app_url']))
        : '';
    $site_id = isset($_POST['infonits_site_agent_site_id'])
        ? sanitize_text_field(wp_unslash($_POST['infonits_site_agent_site_id']))
        : '';
    $token = isset($_POST['infonits_site_agent_token'])
        ? sanitize_text_field(wp_unslash($_POST['infonits_site_agent_token']))
        : '';
    $setup_code = isset($_POST['infonits_site_agent_setup_code'])
        ? sanitize_text_field(wp_unslash($_POST['infonits_site_agent_setup_code']))
        : '';
    if ($setup_code !== '') {
        $normalized = strtr($setup_code, '-_', '+/');
        $remainder = strlen($normalized) % 4;
        if ($remainder) {
            $normalized .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode($normalized, true);
        $connection = is_string($decoded) ? json_decode($decoded, true) : null;
        if (
            !is_array($connection) ||
            empty($connection['appUrl']) ||
            empty($connection['siteId']) ||
            empty($connection['token'])
        ) {
            update_option('infonits_site_agent_last_error', 'The connection code is invalid. Copy a fresh code from Website Care.', false);
            wp_safe_redirect(add_query_arg(array('page' => 'infonits-site-agent', 'agent_status' => 'error'), admin_url('options-general.php')));
            exit;
        }
        $app_url = esc_url_raw((string) $connection['appUrl']);
        $site_id = sanitize_text_field((string) $connection['siteId']);
        $token = sanitize_text_field((string) $connection['token']);
    }
    update_option('infonits_site_agent_app_url', $app_url, false);
    update_option('infonits_site_agent_site_id', $site_id, false);
    update_option('infonits_site_agent_token', $token, false);
    $result = infonits_site_agent_send_health();
    $status = is_wp_error($result) ? 'error' : 'sent';
    wp_safe_redirect(add_query_arg(array('page' => 'infonits-site-agent', 'agent_status' => $status), admin_url('options-general.php')));
    exit;
}
add_action('admin_post_infonits_site_agent_save_test', 'infonits_site_agent_handle_save_test');

function infonits_site_agent_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $status = isset($_GET['agent_status']) ? sanitize_key(wp_unslash($_GET['agent_status'])) : '';
    ?>
    <div class="wrap">
        <h1>Infonits Site Agent</h1>
        <p>This read-only agent reports version, update counts, HTTPS and basic WordPress health. It never sends posts, users, passwords or database content.</p>
        <?php if ($status === 'sent') : ?>
            <div class="notice notice-success is-dismissible"><p>Health report sent successfully.</p></div>
        <?php elseif ($status === 'error') : ?>
            <div class="notice notice-error is-dismissible"><p><?php echo esc_html((string) get_option('infonits_site_agent_last_error', 'Unable to send health report.')); ?></p></div>
        <?php endif; ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="infonits_site_agent_save_test">
            <?php wp_nonce_field('infonits_site_agent_save_test'); ?>
            <h2>Connect this website</h2>
            <p>Copy the connection code from Infonits Finance → Website Care and paste it below.</p>
            <p>
                <label for="infonits_site_agent_setup_code"><strong>Connection code</strong></label><br>
                <textarea class="large-text code" rows="4" id="infonits_site_agent_setup_code" name="infonits_site_agent_setup_code" placeholder="Paste the complete connection code here"></textarea>
            </p>
            <details>
                <summary>Advanced manual connection</summary>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="infonits_site_agent_app_url">Website Care URL</label></th>
                    <td><input class="regular-text" type="url" id="infonits_site_agent_app_url" name="infonits_site_agent_app_url" value="<?php echo esc_attr((string) get_option('infonits_site_agent_app_url', 'https://infonits-finance.vercel.app')); ?>" required></td>
                </tr>
                <tr>
                    <th scope="row"><label for="infonits_site_agent_site_id">Site ID</label></th>
                    <td><input class="regular-text" type="text" id="infonits_site_agent_site_id" name="infonits_site_agent_site_id" value="<?php echo esc_attr((string) get_option('infonits_site_agent_site_id', '')); ?>" required></td>
                </tr>
                <tr>
                    <th scope="row"><label for="infonits_site_agent_token">Agent token</label></th>
                    <td><input class="large-text code" type="password" id="infonits_site_agent_token" name="infonits_site_agent_token" value="<?php echo esc_attr(infonits_site_agent_token()); ?>" autocomplete="off" required></td>
                </tr>
            </table>
            </details>
            <?php submit_button('Connect & send test'); ?>
        </form>
        <hr>
        <h2>Connection status</h2>
        <p><strong>Last sent:</strong> <?php echo esc_html((string) get_option('infonits_site_agent_last_sent', 'Not sent yet')); ?></p>
        <p>To send another report, leave the connection code empty and click <strong>Connect &amp; send test</strong> again.</p>
    </div>
    <?php
}
