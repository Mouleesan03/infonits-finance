<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
final class NITS_Widget {
    private static $shortcode_used = false;
    public static function init() {
        add_shortcode( 'nits_ai', array( __CLASS__, 'shortcode' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        // Render the mount node BEFORE WordPress prints footer scripts (normally priority 20).
        add_action( 'wp_footer', array( __CLASS__, 'footer' ), 5 );
    }
    public static function enqueue() {
        if ( is_admin() ) { return; }
        $o = NITS_Core::options();
        if ( '1' !== $o['enabled'] ) { return; }
        wp_enqueue_style( 'nits-ai', NITS_AI_URL . 'assets/css/nits-widget.css', array(), NITS_AI_VERSION );
        wp_enqueue_script( 'nits-ai', NITS_AI_URL . 'assets/js/nits-widget.js', array(), NITS_AI_VERSION, true );
        $cfg = array(
            'rest' => esc_url_raw( rest_url( 'nits/v1/' ) ),
            'name' => $o['display_name'], 'subtitle' => $o['subtitle'],
            'welcome' => $o['welcome'], 'color' => NITS_Core::safe_hex( $o['primary_color'] ),
            'assets' => NITS_AI_URL . 'assets/img/', 'configured' => (bool) NITS_Core::key(),
            'whatsapp' => $o['whatsapp'], 'privacyUrl' => get_privacy_policy_url(),
            'hasKey' => (bool) NITS_Core::key(),
        );
        wp_add_inline_script( 'nits-ai', 'window.NITS_CONFIG = ' . wp_json_encode( $cfg ) . ';', 'before' );
    }
    public static function shortcode() {
        $o = NITS_Core::options();
        if ( '1' !== $o['enabled'] ) { return ''; }
        self::$shortcode_used = true;
        return '<div id="nits-ai-root" data-nits-placement="shortcode"></div>';
    }
    public static function footer() {
        $o = NITS_Core::options();
        if ( '1' !== $o['enabled'] || 'all' !== $o['placement'] || self::$shortcode_used ) { return; }
        echo '<div id="nits-ai-root" data-nits-placement="floating"></div>';
    }
}
