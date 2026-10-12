<?php
/** Clean up NITS AI options and submitted leads when the plugin is deleted (not merely deactivated). */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) { exit; }
if ( function_exists( 'wp_clear_scheduled_hook' ) ) { wp_clear_scheduled_hook( 'nits_ai_prune' ); }
delete_option( 'nits_ai_settings' );
delete_option( 'nits_ai_api_key' );
delete_option( 'nits_ai_dashboard_secret' );
global $wpdb;
$table = $wpdb->prefix . 'nits_ai_leads';
$wpdb->query( "DROP TABLE IF EXISTS $table" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
