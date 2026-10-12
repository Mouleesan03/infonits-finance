<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
final class NITS_Admin {
    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
        add_action( 'admin_post_nits_save_settings', array( __CLASS__, 'save' ) );
        add_action( 'admin_post_nits_export_leads', array( __CLASS__, 'export' ) );
        add_action( 'admin_post_nits_lead_action', array( __CLASS__, 'lead_action' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
    }
    public static function menu() {
        add_menu_page( 'NITS AI', 'NITS AI', 'manage_options', 'nits-ai', array( __CLASS__, 'dashboard' ), 'dashicons-format-chat', 26 );
        add_submenu_page( 'nits-ai', 'Overview', 'Overview', 'manage_options', 'nits-ai', array( __CLASS__, 'dashboard' ) );
        add_submenu_page( 'nits-ai', 'Leads', 'Leads', 'manage_options', 'nits-ai-leads', array( __CLASS__, 'leads' ) );
        add_submenu_page( 'nits-ai', 'Settings', 'Settings', 'manage_options', 'nits-ai-settings', array( __CLASS__, 'settings' ) );
    }
    public static function assets( $hook ) {
        if ( strpos( $hook, 'nits-ai' ) === false ) { return; }
        wp_enqueue_style( 'nits-admin', NITS_AI_URL . 'assets/css/nits-admin.css', array(), NITS_AI_VERSION );
    }
    private static function header( $page ) {
        echo '<div class="wrap nits-admin"><div class="nits-admin-hero"><div class="nits-admin-hero-text"><span class="nits-pill">INFONITS · AI AGENT</span><h1>NITS AI <span> / ' . esc_html( $page ) . '</span></h1><p>Your website assistant, project enquiries and Claude integration — managed entirely in WordPress.</p></div><img src="' . esc_url( NITS_AI_URL . 'assets/img/nits-greeting.svg' ) . '" alt="NITS mascot" /></div>';
        if ( isset( $_GET['updated'] ) ) { echo '<div class="notice notice-success is-dismissible"><p>Settings saved successfully.</p></div>'; }
        if ( isset( $_GET['lead_updated'] ) ) { echo '<div class="notice notice-success is-dismissible"><p>Lead updated.</p></div>'; }
    }
    private static function footer() { echo '</div>'; }
    public static function dashboard() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        global $wpdb;
        $t = $wpdb->prefix . 'nits_ai_leads';
        $total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t" ); // phpcs:ignore
        $new = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t WHERE status = 'new'" ); // phpcs:ignore
        $month = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE created_at >= %s", gmdate( 'Y-m-01 00:00:00' ) ) ); // phpcs:ignore
        $o = NITS_Core::options();
        self::header( 'Overview' );
        echo '<div class="nits-cards">';
        self::metric( 'All project enquiries', $total, 'dashicons-groups' );
        self::metric( 'New enquiries', $new, 'dashicons-email-alt' );
        self::metric( 'This month', $month, 'dashicons-chart-bar' );
        self::metric( 'AI status', NITS_Core::key() ? 'Key saved' : 'Set up key', 'dashicons-admin-network' );
        echo '</div><div class="nits-two-col"><section class="nits-panel"><h2>Get started</h2><ol><li>Open <a href="' . esc_url( admin_url( 'admin.php?page=nits-ai-settings' ) ) . '">NITS AI → Settings</a>.</li><li>Paste your <strong>Anthropic Claude API key</strong>, choose your model and save.</li><li>Click <strong>Test Claude connection</strong> in Settings.</li><li>Optionally connect the Infonits dashboard lead webhook.</li><li>Enable the floating assistant and submit a test project enquiry.</li></ol><p><a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=nits-ai-settings' ) ) . '">Configure NITS →</a> <a class="button" href="' . esc_url( home_url() ) . '" target="_blank" rel="noopener noreferrer">View site ↗</a></p></section>';
        echo '<section class="nits-panel"><h2>Current configuration</h2><p><strong>Website display:</strong> ' . ( '1' === $o['enabled'] ? 'Enabled' : 'Disabled' ) . '</p><p><strong>Placement:</strong> ' . esc_html( $o['placement'] ) . '</p><p><strong>Claude model:</strong> <code>' . esc_html( $o['model'] ) . '</code></p><p><strong>Dashboard lead sync:</strong> ' . ( '1' === $o['dashboard_sync'] ? 'Enabled' : 'Disabled' ) . '</p><p><strong>Daily API request cap:</strong> ' . esc_html( $o['daily_limit'] ) . '</p><p><strong>Data retention:</strong> ' . esc_html( $o['retention_days'] ) . ' days</p><p><strong>Manual shortcode:</strong> <code>[nits_ai]</code></p><p><strong>Storage:</strong> WordPress database first; optional dashboard sync</p></section></div>';
        self::footer();
    }
    private static function metric( $name, $value, $icon ) {
        echo '<div class="nits-metric"><span class="dashicons ' . esc_attr( $icon ) . '"></span><div class="nits-metric-num">' . esc_html( (string) $value ) . '</div><div>' . esc_html( $name ) . '</div></div>';
    }
    public static function settings() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        $o = NITS_Core::options();
        self::header( 'Settings' );
        echo '<div class="nits-panel nits-settings-panel"><form action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" method="post">';
        echo '<input type="hidden" name="action" value="nits_save_settings">';
        wp_nonce_field( 'nits_save_settings' );
        echo '<h2>Claude AI connection</h2><p class="description">The key remains on your WordPress server. Leave the password field empty to keep the existing key.</p>';
        echo '<div class="nits-setting"><label for="nits_key">Claude API key</label><div><input class="regular-text" type="password" id="nits_key" name="api_key" value="" placeholder="' . ( NITS_Core::key() ? '•••••••• (key saved — leave blank to keep)' : 'sk-ant-...' ) . '" autocomplete="new-password" /><p class="description">Key is never sent to visitors. Optional stronger protection: put <code>define(\'NITS_ANTHROPIC_API_KEY\', \'...\');</code> in wp-config.php.</p><label><input type="checkbox" name="clear_key" value="1"> Remove saved API key</label></div></div>';
        self::select( 'model', 'Claude model', $o['model'], array( 'claude-haiku-4-5' => 'Claude Haiku 4.5 — lower cost', 'claude-sonnet-5' => 'Claude Sonnet 5 — stronger answers', 'claude-sonnet-4-6' => 'Claude Sonnet 4.6 — balanced' ) );
        self::number( 'max_tokens', 'Maximum reply tokens', $o['max_tokens'], 128, 1800 );
        echo '<div class="nits-setting"><label>Connection check</label><div><button id="nits-test-btn" type="button" class="button">Test Claude connection</button><span id="nits-test-output" aria-live="polite"></span></div></div>';
        echo '<hr /><h2>Website appearance</h2>';
        self::checkbox( 'enabled', 'Enable NITS assistant', $o['enabled'] );
        self::select( 'placement', 'Widget placement', $o['placement'], array( 'all' => 'Floating assistant on the whole website', 'shortcode' => 'Only where [nits_ai] shortcode is used' ) );
        self::text( 'display_name', 'Assistant name', $o['display_name'] );
        self::text( 'subtitle', 'Assistant subtitle', $o['subtitle'] );
        self::text( 'welcome', 'Welcome message', $o['welcome'] );
        echo '<div class="nits-setting"><label for="primary_color">Accent colour</label><div><input type="color" name="primary_color" id="primary_color" value="' . esc_attr( $o['primary_color'] ) . '" /> <span class="description">Infonits blue by default</span></div></div>';
        echo '<hr /><h2>Business knowledge & notifications</h2><p class="description">NITS uses these facts and public pages/posts from your WordPress website. Keep pricing, capabilities and contact details accurate.</p>';
        echo '<div class="nits-setting"><label for="additional_knowledge">Approved knowledge / FAQs</label><div><textarea id="additional_knowledge" name="additional_knowledge" rows="12" class="large-text code">' . esc_textarea( $o['additional_knowledge'] ) . '</textarea><p class="description">Up to 8,000 characters. Include FAQs, services, process, availability and any approved answers.</p></div></div>';
        self::text( 'email', 'Lead notification email', $o['email'], 'email' );
        self::text( 'whatsapp', 'WhatsApp number (international digits)', $o['whatsapp'], 'text', 'e.g. 94771234567 (no + or spaces). Leave empty to hide WhatsApp handoff.' );
        echo '<hr /><h2>Infonits dashboard lead sync</h2><p class="description">Every enquiry is saved in WordPress first. When enabled, a server-side copy is also sent to the Agent Leads dashboard. The secret is never exposed to website visitors.</p>';
        self::checkbox( 'dashboard_sync', 'Send leads to dashboard', $o['dashboard_sync'] );
        self::text( 'dashboard_webhook_url', 'Dashboard webhook URL', $o['dashboard_webhook_url'], 'url', 'Example: https://your-dashboard.example/api/agent-leads. HTTPS is required.' );
        echo '<div class="nits-setting"><label for="dashboard_secret">Webhook secret</label><div><input class="regular-text" type="password" id="dashboard_secret" name="dashboard_secret" value="" placeholder="' . ( NITS_Core::dashboard_secret() ? '•••••••• (secret saved — leave blank to keep)' : 'Paste the same secret used by the dashboard' ) . '" autocomplete="new-password" /><p class="description">Optional stronger protection: put <code>define(\'NITS_LEAD_WEBHOOK_SECRET\', \'...\');</code> in wp-config.php.</p><label><input type="checkbox" name="clear_dashboard_secret" value="1"> Remove saved webhook secret</label></div></div>';
        echo '<div class="nits-setting"><label>Connection check</label><div><button id="nits-dashboard-test-btn" type="button" class="button">Test dashboard connection</button><span id="nits-dashboard-test-output" aria-live="polite"></span><p class="description">Save settings first. The test creates one clearly labelled test lead in the dashboard.</p></div></div>';
        echo '<hr /><h2>Limits & privacy</h2>';
        self::number( 'daily_limit', 'Maximum Claude requests per day', $o['daily_limit'], 20, 10000 );
        self::number( 'retention_days', 'Lead retention (days)', $o['retention_days'], 1, 3650 );
        echo '<p class="description">Lead records are deleted by WordPress cron after the retention period. Add your privacy disclosure to the site privacy policy. The plugin does not store anonymous chat messages; the optional chat transcript is saved only when a visitor consents to submitting a lead.</p>';
        submit_button( 'Save NITS settings' );
        echo '</form></div>';
        echo '<script>document.addEventListener("DOMContentLoaded",function(){function wire(id,out,action,nonce){var b=document.getElementById(id),o=document.getElementById(out);if(!b)return;b.addEventListener("click",async function(){b.disabled=true;o.textContent=" Checking connection…";try{var p=new URLSearchParams({action:action,nonce:nonce});var r=await fetch(' . wp_json_encode( admin_url( 'admin-ajax.php' ) ) . ',{method:"POST",credentials:"same-origin",body:p});var j=await r.json();o.textContent=" "+((j.data&&j.data.message)||"Connection test failed");o.style.color=j.success?"#067a4d":"#b91c1c";}catch(e){o.textContent=" Connection test failed";o.style.color="#b91c1c";}finally{b.disabled=false;}});}wire("nits-test-btn","nits-test-output","nits_test_api",' . wp_json_encode( wp_create_nonce( 'nits_test_api' ) ) . ');wire("nits-dashboard-test-btn","nits-dashboard-test-output","nits_test_dashboard",' . wp_json_encode( wp_create_nonce( 'nits_test_dashboard' ) ) . ');});</script>';
        self::footer();
    }
    private static function text( $key, $label, $value, $type = 'text', $hint = '' ) {
        echo '<div class="nits-setting"><label for="' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label><div><input type="' . esc_attr( $type ) . '" name="' . esc_attr( $key ) . '" id="' . esc_attr( $key ) . '" class="regular-text" value="' . esc_attr( $value ) . '" />' . ( $hint ? '<p class="description">' . esc_html( $hint ) . '</p>' : '' ) . '</div></div>';
    }
    private static function number( $key, $label, $value, $min, $max ) {
        echo '<div class="nits-setting"><label for="' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label><div><input type="number" name="' . esc_attr( $key ) . '" id="' . esc_attr( $key ) . '" min="' . esc_attr( $min ) . '" max="' . esc_attr( $max ) . '" value="' . esc_attr( $value ) . '" /></div></div>';
    }
    private static function checkbox( $key, $label, $value ) {
        echo '<div class="nits-setting"><label for="' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label><div><label><input type="checkbox" name="' . esc_attr( $key ) . '" id="' . esc_attr( $key ) . '" value="1" ' . checked( '1', $value, false ) . ' /> Enabled</label></div></div>';
    }
    private static function select( $key, $label, $value, $choices ) {
        echo '<div class="nits-setting"><label for="' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label><div><select name="' . esc_attr( $key ) . '" id="' . esc_attr( $key ) . '">';
        foreach ( $choices as $v => $text ) { echo '<option value="' . esc_attr( $v ) . '" ' . selected( $value, $v, false ) . '>' . esc_html( $text ) . '</option>'; }
        echo '</select></div></div>';
    }
    public static function save() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Not authorized', 403 ); }
        check_admin_referer( 'nits_save_settings' );
        $in = isset( $_POST ) ? wp_unslash( $_POST ) : array();
        $o = NITS_Core::options();
        $o['enabled'] = isset( $in['enabled'] ) ? '1' : '0';
        $o['placement'] = isset( $in['placement'] ) && 'shortcode' === $in['placement'] ? 'shortcode' : 'all';
        $o['primary_color'] = NITS_Core::safe_hex( isset( $in['primary_color'] ) ? $in['primary_color'] : '' );
        foreach ( array( 'display_name' => 45, 'subtitle' => 75, 'welcome' => 300 ) as $key => $len ) {
            $o[ $key ] = NITS_Core::clip( sanitize_text_field( isset( $in[ $key ] ) ? $in[ $key ] : '' ), 0, $len );
        }
        $o['email'] = sanitize_email( isset( $in['email'] ) ? $in['email'] : '' );
        $o['whatsapp'] = preg_replace( '/\D/', '', isset( $in['whatsapp'] ) ? $in['whatsapp'] : '' );
        $o['whatsapp'] = substr( $o['whatsapp'], 0, 16 );
        $o['dashboard_sync'] = isset( $in['dashboard_sync'] ) ? '1' : '0';
        $dashboard_url = esc_url_raw( isset( $in['dashboard_webhook_url'] ) ? $in['dashboard_webhook_url'] : '', array( 'https' ) );
        $o['dashboard_webhook_url'] = 0 === strpos( $dashboard_url, 'https://' ) ? $dashboard_url : '';
        $o['additional_knowledge'] = NITS_Core::clip( sanitize_textarea_field( isset( $in['additional_knowledge'] ) ? $in['additional_knowledge'] : '' ), 0, 8000 );
        $allowed = array( 'claude-haiku-4-5', 'claude-sonnet-5', 'claude-sonnet-4-6' );
        $o['model'] = isset( $in['model'] ) && in_array( $in['model'], $allowed, true ) ? $in['model'] : 'claude-haiku-4-5';
        foreach ( array( 'max_tokens' => array( 128, 1800 ), 'daily_limit' => array( 20, 10000 ), 'retention_days' => array( 1, 3650 ) ) as $key => $limits ) {
            $o[ $key ] = max( $limits[0], min( $limits[1], absint( isset( $in[ $key ] ) ? $in[ $key ] : 0 ) ) );
        }
        update_option( 'nits_ai_settings', $o, false );
        if ( ! defined( 'NITS_ANTHROPIC_API_KEY' ) ) {
            if ( ! empty( $in['clear_key'] ) ) {
                delete_option( 'nits_ai_api_key' );
            } elseif ( ! empty( $in['api_key'] ) ) {
                $key = trim( (string) $in['api_key'] );
                if ( strlen( $key ) >= 20 && strlen( $key ) < 300 ) { update_option( 'nits_ai_api_key', $key, false ); }
            }
        }
        if ( ! defined( 'NITS_LEAD_WEBHOOK_SECRET' ) ) {
            if ( ! empty( $in['clear_dashboard_secret'] ) ) {
                delete_option( 'nits_ai_dashboard_secret' );
            } elseif ( ! empty( $in['dashboard_secret'] ) ) {
                $secret = trim( (string) $in['dashboard_secret'] );
                if ( strlen( $secret ) >= 24 && strlen( $secret ) <= 500 ) { update_option( 'nits_ai_dashboard_secret', $secret, false ); }
            }
        }
        wp_safe_redirect( admin_url( 'admin.php?page=nits-ai-settings&updated=1' ) );
        exit;
    }
    public static function leads() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        global $wpdb;
        $t = $wpdb->prefix . 'nits_ai_leads';
        self::header( 'Leads' );
        if ( isset( $_GET['view'] ) ) {
            $id = absint( $_GET['view'] );
            $lead = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE id = %d", $id ) ); // phpcs:ignore
            if ( ! $lead ) { echo '<p>Lead not found.</p>'; self::footer(); return; }
            echo '<div class="nits-panel"><p><a href="' . esc_url( admin_url( 'admin.php?page=nits-ai-leads' ) ) . '">← Back to leads</a></p><h2>Enquiry #' . esc_html( $lead->id ) . '</h2><dl class="nits-lead-fields">';
            foreach ( array( 'created_at' => 'Received (UTC)', 'name' => 'Name', 'email' => 'Email', 'phone' => 'Phone', 'service' => 'Service', 'budget' => 'Budget', 'timeline' => 'Timeline', 'details' => 'Project details', 'page_url' => 'Source page', 'status' => 'Status' ) as $key => $label ) {
                echo '<dt>' . esc_html( $label ) . '</dt><dd>' . nl2br( esc_html( $lead->$key ) ) . '</dd>';
            }
            echo '</dl><h3>Conversation excerpt (submitted with consent)</h3>';
            $messages = json_decode( $lead->conversation, true );
            if ( is_array( $messages ) && $messages ) {
                echo '<div class="nits-conversation">';
                foreach ( $messages as $m ) { echo '<p><strong>' . esc_html( ucfirst( $m['role'] ) ) . ':</strong> ' . nl2br( esc_html( $m['text'] ) ) . '</p>'; }
                echo '</div>';
            } else { echo '<p>No conversation included.</p>'; }
            echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="nits_lead_action"><input type="hidden" name="id" value="' . esc_attr( $id ) . '">';
            wp_nonce_field( 'nits_lead_' . $id );
            echo '<label><strong>Update status: </strong> <select name="status"><option value="new" ' . selected( $lead->status, 'new', false ) . '>New</option><option value="contacted" ' . selected( $lead->status, 'contacted', false ) . '>Contacted</option><option value="qualified" ' . selected( $lead->status, 'qualified', false ) . '>Qualified</option><option value="closed" ' . selected( $lead->status, 'closed', false ) . '>Closed</option></select></label> <button type="submit" class="button button-primary">Update lead</button> <button type="submit" name="delete" value="1" class="button" onclick="return confirm(\'Permanently delete this lead?\')">Delete lead</button></form></div>';
            self::footer(); return;
        }
        $page = max( 1, absint( isset( $_GET['paged'] ) ? $_GET['paged'] : 1 ) );
        $limit = 20;
        $offset = ( $page - 1 ) * $limit;
        $total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $t" ); // phpcs:ignore
        $rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, created_at, name, email, service, status FROM $t ORDER BY id DESC LIMIT %d OFFSET %d", $limit, $offset ) ); // phpcs:ignore
        echo '<div class="nits-panel"><div class="nits-list-head"><div><h2>Project enquiries</h2><p>' . esc_html( $total ) . ' total submissions</p></div><a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=nits_export_leads' ), 'nits_export_leads' ) ) . '">Export CSV ↓</a></div><div class="nits-table-scroll"><table class="widefat striped"><thead><tr><th>ID</th><th>Date (UTC)</th><th>Name</th><th>Email</th><th>Service</th><th>Status</th><th></th></tr></thead><tbody>';
        if ( ! $rows ) { echo '<tr><td colspan="7">No leads yet. Test the form on your website to create one.</td></tr>'; }
        foreach ( $rows as $r ) {
            echo '<tr><td>#' . esc_html( $r->id ) . '</td><td>' . esc_html( $r->created_at ) . '</td><td><strong>' . esc_html( $r->name ) . '</strong></td><td>' . esc_html( $r->email ) . '</td><td>' . esc_html( $r->service ) . '</td><td><span class="nits-status">' . esc_html( ucfirst( $r->status ) ) . '</span></td><td><a href="' . esc_url( admin_url( 'admin.php?page=nits-ai-leads&view=' . absint( $r->id ) ) ) . '">View →</a></td></tr>';
        }
        echo '</tbody></table></div>';
        if ( $total > $limit ) {
            echo '<p class="nits-pagination">' . wp_kses_post( paginate_links( array( 'base' => add_query_arg( 'paged', '%#%' ), 'format' => '', 'current' => $page, 'total' => ceil( $total / $limit ) ) ) ) . '</p>';
        }
        echo '</div>';
        self::footer();
    }
    public static function lead_action() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Not authorized', 403 ); }
        $id = absint( isset( $_POST['id'] ) ? $_POST['id'] : 0 );
        check_admin_referer( 'nits_lead_' . $id );
        global $wpdb;
        $table = $wpdb->prefix . 'nits_ai_leads';
        if ( ! empty( $_POST['delete'] ) ) {
            $wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
        } else {
            $s = isset( $_POST['status'] ) ? sanitize_key( $_POST['status'] ) : 'new';
            if ( in_array( $s, array( 'new', 'contacted', 'qualified', 'closed' ), true ) ) {
                $wpdb->update( $table, array( 'status' => $s ), array( 'id' => $id ), array( '%s' ), array( '%d' ) );
            }
        }
        wp_safe_redirect( admin_url( 'admin.php?page=nits-ai-leads&lead_updated=1' ) );
        exit;
    }
    public static function export() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Not authorized', 403 ); }
        check_admin_referer( 'nits_export_leads' );
        global $wpdb;
        $t = $wpdb->prefix . 'nits_ai_leads';
        nocache_headers();
        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename="nits-leads-' . gmdate( 'Y-m-d' ) . '.csv"' );
        $out = fopen( 'php://output', 'w' );
        fputcsv( $out, array( 'ID', 'Date (UTC)', 'Name', 'Email', 'Phone', 'Service', 'Budget', 'Timeline', 'Project', 'Source', 'Status' ) );
        $offset = 0;
        do {
            $rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $t ORDER BY id DESC LIMIT 200 OFFSET %d", $offset ), ARRAY_A ); // phpcs:ignore
            foreach ( $rows as $r ) {
                $cells = array();
                foreach ( array( 'id', 'created_at', 'name', 'email', 'phone', 'service', 'budget', 'timeline', 'details', 'page_url', 'status' ) as $field ) {
                    $v = (string) $r[ $field ];
                    if ( preg_match( '/^[\s]*[=+\-@]/u', $v ) ) { $v = "'" . $v; } // CSV formula injection defense
                    $cells[] = $v;
                }
                fputcsv( $out, $cells );
            }
            $offset += 200;
        } while ( count( $rows ) === 200 );
        fclose( $out );
        exit;
    }
}
