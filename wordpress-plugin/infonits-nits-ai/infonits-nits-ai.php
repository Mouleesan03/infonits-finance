<?php
/**
 * Plugin Name: Infonits NITS AI — Claude Chat & Leads
 * Plugin URI: https://infonits.io/
 * Description: NITS animated assistant for WordPress: Claude-powered conversations, site knowledge, project leads and an admin dashboard.
 * Version: 1.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Infonits
 * License: GPL-2.0-or-later
 * Text Domain: infonits-nits-ai
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
define( 'NITS_AI_VERSION', '1.1.0' );
define( 'NITS_AI_DIR', plugin_dir_path( __FILE__ ) );
define( 'NITS_AI_URL', plugin_dir_url( __FILE__ ) );

require_once NITS_AI_DIR . 'includes/class-nits-core.php';
require_once NITS_AI_DIR . 'includes/class-nits-api.php';
require_once NITS_AI_DIR . 'includes/class-nits-admin.php';
require_once NITS_AI_DIR . 'includes/class-nits-widget.php';

register_activation_hook( __FILE__, array( 'NITS_Core', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'NITS_Core', 'deactivate' ) );
add_action( 'plugins_loaded', function () {
    NITS_Core::init();
    NITS_API::init();
    NITS_Admin::init();
    NITS_Widget::init();
} );
