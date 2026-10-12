<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
final class NITS_Core {
    public static function defaults() {
        return array(
            'enabled' => '1', 'placement' => 'all', 'primary_color' => '#1266F1',
            'display_name' => 'NITS', 'subtitle' => 'Infonits AI Assistant',
            'welcome' => "Hi! 👋 I'm NITS, your digital assistant at Infonits. What are you planning to build?",
            'model' => 'claude-haiku-4-5', 'max_tokens' => 550,
            'email' => get_option( 'admin_email' ), 'whatsapp' => '',
            'dashboard_sync' => '0', 'dashboard_webhook_url' => '',
            'additional_knowledge' => "Infonits provides website development (WordPress, Elementor, React), full-stack software (Next.js, Node.js, Supabase), mobile apps, branding, graphic design and UI/UX.\nProject process: Discover → Design & Build → Launch & Grow.\nDo not quote binding prices or delivery dates. The human team will provide a custom quote.",
            'daily_limit' => 250, 'retention_days' => 180,
        );
    }
    public static function options() {
        $o = get_option( 'nits_ai_settings', array() );
        return wp_parse_args( is_array( $o ) ? $o : array(), self::defaults() );
    }
    public static function key() {
        if ( defined( 'NITS_ANTHROPIC_API_KEY' ) && NITS_ANTHROPIC_API_KEY ) {
            return (string) NITS_ANTHROPIC_API_KEY;
        }
        return (string) get_option( 'nits_ai_api_key', '' );
    }
    public static function dashboard_secret() {
        if ( defined( 'NITS_LEAD_WEBHOOK_SECRET' ) && NITS_LEAD_WEBHOOK_SECRET ) {
            return (string) NITS_LEAD_WEBHOOK_SECRET;
        }
        return (string) get_option( 'nits_ai_dashboard_secret', '' );
    }
    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $name = $wpdb->prefix . 'nits_ai_leads';
        $charset = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE $name (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            created_at datetime NOT NULL,
            name varchar(190) NOT NULL,
            email varchar(190) NOT NULL,
            phone varchar(90) NOT NULL DEFAULT '',
            service varchar(100) NOT NULL DEFAULT '',
            budget varchar(100) NOT NULL DEFAULT '',
            timeline varchar(100) NOT NULL DEFAULT '',
            details text NOT NULL,
            conversation longtext NULL,
            page_url varchar(500) NOT NULL DEFAULT '',
            consent tinyint(1) NOT NULL DEFAULT 1,
            status varchar(30) NOT NULL DEFAULT 'new',
            PRIMARY KEY  (id),
            KEY created_at (created_at),
            KEY status (status)
        ) $charset;";
        dbDelta( $sql );
        if ( false === get_option( 'nits_ai_settings', false ) ) {
            add_option( 'nits_ai_settings', self::defaults(), '', false );
        }
        if ( ! wp_next_scheduled( 'nits_ai_prune' ) ) {
            wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'nits_ai_prune' );
        }
    }
    public static function init() {
        add_action( 'nits_ai_prune', array( __CLASS__, 'prune' ) );
        add_filter( 'wp_privacy_personal_data_exporters', array( __CLASS__, 'register_exporter' ) );
        add_filter( 'wp_privacy_personal_data_erasers', array( __CLASS__, 'register_eraser' ) );
        add_action( 'admin_init', function () {
            if ( ! wp_next_scheduled( 'nits_ai_prune' ) ) {
                wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'nits_ai_prune' );
            }
        } );
    }
    public static function deactivate() {
        wp_clear_scheduled_hook( 'nits_ai_prune' );
    }
    public static function prune() {
        global $wpdb;
        $o = self::options();
        $days = max( 1, min( 3650, absint( $o['retention_days'] ) ) );
        $cutoff = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
        $table = $wpdb->prefix . 'nits_ai_leads';
        $wpdb->query( $wpdb->prepare( "DELETE FROM $table WHERE created_at < %s", $cutoff ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    }
    public static function clip( $text, $start, $length = null ) {
        $text = (string) $text;
        if ( function_exists( 'mb_substr' ) ) {
            return null === $length ? mb_substr( $text, $start ) : mb_substr( $text, $start, $length );
        }
        if ( function_exists( 'iconv_substr' ) ) {
            return null === $length ? iconv_substr( $text, $start, iconv_strlen( $text, 'UTF-8' ), 'UTF-8' ) : iconv_substr( $text, $start, $length, 'UTF-8' );
        }
        return null === $length ? substr( $text, $start ) : substr( $text, $start, $length );
    }
    public static function text_length( $text ) {
        if ( function_exists( 'mb_strlen' ) ) { return mb_strlen( (string) $text ); }
        if ( function_exists( 'iconv_strlen' ) ) { return iconv_strlen( (string) $text, 'UTF-8' ); }
        return strlen( (string) $text );
    }
    public static function lower( $text ) {
        return function_exists( 'mb_strtolower' ) ? mb_strtolower( (string) $text ) : strtolower( (string) $text );
    }
    public static function register_exporter( $exporters ) {
        $exporters['nits-ai-leads'] = array( 'exporter_friendly_name' => 'NITS AI project enquiries', 'callback' => array( __CLASS__, 'export_personal_data' ) );
        return $exporters;
    }
    public static function register_eraser( $erasers ) {
        $erasers['nits-ai-leads'] = array( 'eraser_friendly_name' => 'NITS AI project enquiries', 'callback' => array( __CLASS__, 'erase_personal_data' ) );
        return $erasers;
    }
    public static function export_personal_data( $email, $page = 1 ) {
        global $wpdb;
        $page = max( 1, absint( $page ) );
        $limit = 25;
        $table = $wpdb->prefix . 'nits_ai_leads';
        $rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE email = %s ORDER BY id ASC LIMIT %d OFFSET %d", sanitize_email( $email ), $limit, ( $page - 1 ) * $limit ) ); // phpcs:ignore
        $items = array();
        foreach ( (array) $rows as $r ) {
            $data = array();
            foreach ( array( 'created_at' => 'Submission date (UTC)', 'name' => 'Name', 'email' => 'Email', 'phone' => 'Phone', 'service' => 'Requested service', 'budget' => 'Budget range', 'timeline' => 'Timeline', 'details' => 'Project details', 'conversation' => 'Shared chat transcript', 'page_url' => 'Page URL' ) as $key => $label ) {
                $data[] = array( 'name' => $label, 'value' => (string) $r->$key );
            }
            $items[] = array( 'group_id' => 'nits-project-leads', 'group_label' => 'NITS project enquiries', 'item_id' => 'nits-lead-' . $r->id, 'data' => $data );
        }
        return array( 'data' => $items, 'done' => count( $rows ) < $limit );
    }
    public static function erase_personal_data( $email, $page = 1 ) {
        global $wpdb;
        $table = $wpdb->prefix . 'nits_ai_leads';
        $email = sanitize_email( $email );
        $rows = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM $table WHERE email = %s LIMIT 100", $email ) ); // phpcs:ignore
        foreach ( (array) $rows as $id ) {
            $wpdb->delete( $table, array( 'id' => absint( $id ) ), array( '%d' ) );
        }
        return array( 'items_removed' => count( $rows ) > 0, 'items_retained' => false, 'messages' => array(), 'done' => count( $rows ) < 100 );
    }
    public static function safe_hex( $value ) {
        return sanitize_hex_color( $value ) ?: '#1266F1';
    }
    public static function ip_hash() {
        // IP is never stored in lead records. Hashed value is transient abuse protection only.
        $ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
        return substr( hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) ), 0, 22 );
    }
    public static function rate_check( $kind = 'chat' ) {
        $key = 'nits_rl_' . $kind . '_' . self::ip_hash();
        $max = 'lead' === $kind ? 8 : 30;
        $count = (int) get_transient( $key );
        if ( $count >= $max ) { return false; }
        set_transient( $key, $count + 1, HOUR_IN_SECONDS );
        return true;
    }
}
