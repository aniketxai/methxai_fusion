#include "cold_chain_controller.h"
#include <string.h>

cold_chain_state_t g_cold_chain;

static int16_t default_history[12] = { 36, 38, 39, 41, 39, 38, 37, 38, 40, 39, 38, 38 };

void cold_chain_init(void)
{
    g_cold_chain.current_temp         = 3.8f;
    g_cold_chain.min_temp_limit       = 2.0f;
    g_cold_chain.max_temp_limit       = 8.0f;
    g_cold_chain.current_humidity     = 52.0f;
    g_cold_chain.sensor_connected     = true;
    g_cold_chain.is_simulated         = true; // clearly labeled until live sensor overrides
    g_cold_chain.last_update_sec      = 3;

    g_cold_chain.shipment_id          = "SHP-2024-IN-882";
    g_cold_chain.batch_id             = "B-7749";
    g_cold_chain.product_name         = "Covaxin Inactivated Vaccine (0.5ml)";
    g_cold_chain.expiry_date          = "2027-08-31";
    g_cold_chain.checkpoint           = "Depot Hub 3 -> Dispenser Unit 04";
    g_cold_chain.gps_coord            = "28.6139 N, 77.2090 E";
    g_cold_chain.gps_simulated        = true;

    g_cold_chain.excursion_count      = 0;
    g_cold_chain.batch_status         = BATCH_STATUS_RELEASED;
    g_cold_chain.batch_status_reason  = "Cold-chain telemetry validated. Safe for dispensing.";

    memcpy(g_cold_chain.temp_history, default_history, sizeof(default_history));
}

bool cold_chain_is_dispense_allowed(void)
{
    if (!g_cold_chain.sensor_connected) {
        return false;
    }
    if (g_cold_chain.batch_status != BATCH_STATUS_RELEASED) {
        return false;
    }
    if (g_cold_chain.current_temp > g_cold_chain.max_temp_limit ||
        g_cold_chain.current_temp < g_cold_chain.min_temp_limit) {
        return false;
    }
    return true;
}

const char* cold_chain_get_batch_status_str(void)
{
    switch (g_cold_chain.batch_status) {
        case BATCH_STATUS_RELEASED:
            return "RELEASE APPROVED";
        case BATCH_STATUS_HOLD:
            return "BATCH ON HOLD";
        case BATCH_STATUS_EXCURSION:
            return "CRITICAL EXCURSION";
        case BATCH_STATUS_REVIEW_REQUIRED:
        default:
            return "REVIEW REQUIRED";
    }
}

const char* cold_chain_get_dispense_lock_reason(void)
{
    if (!g_cold_chain.sensor_connected) {
        return "System Offline: Sensor Disconnected";
    }
    if (g_cold_chain.batch_status == BATCH_STATUS_HOLD) {
        return "Batch on Hold: Dispensing Locked";
    }
    if (g_cold_chain.batch_status == BATCH_STATUS_EXCURSION) {
        return "Excursion Alert: Temperature Limit Breached";
    }
    if (g_cold_chain.batch_status == BATCH_STATUS_REVIEW_REQUIRED) {
        return "Verification Required Before Dispense";
    }
    if (g_cold_chain.current_temp > g_cold_chain.max_temp_limit ||
        g_cold_chain.current_temp < g_cold_chain.min_temp_limit) {
        return "Temperature Out of Safe Range (2.0-8.0 C)";
    }
    return "Batch Verified: Dispenser Ready";
}

void cold_chain_set_batch_status(batch_status_t new_status, const char *reason)
{
    g_cold_chain.batch_status = new_status;
    if (reason) {
        g_cold_chain.batch_status_reason = reason;
    }
}

void cold_chain_update_telemetry(float temp, float humidity, bool is_real_sensor)
{
    g_cold_chain.current_temp     = temp;
    g_cold_chain.current_humidity = humidity;
    g_cold_chain.sensor_connected = true;
    g_cold_chain.is_simulated     = !is_real_sensor;
    g_cold_chain.last_update_sec  = 0;

    // Check excursion
    if (temp > g_cold_chain.max_temp_limit || temp < g_cold_chain.min_temp_limit) {
        g_cold_chain.excursion_count++;
        g_cold_chain.batch_status = BATCH_STATUS_EXCURSION;
        g_cold_chain.batch_status_reason = "Temperature excursion breached safe limit.";
    }

    // Shift history
    for (int i = 0; i < 11; i++) {
        g_cold_chain.temp_history[i] = g_cold_chain.temp_history[i + 1];
    }
    g_cold_chain.temp_history[11] = (int16_t)(temp * 10.0f);
}

void cold_chain_tick(void)
{
    g_cold_chain.last_update_sec++;
    if (g_cold_chain.is_simulated) {
        // Small realistic drift between 3.7 C and 4.0 C
        static int drift_dir = 1;
        static int drift_cnt = 0;
        drift_cnt++;
        if (drift_cnt >= 5) {
            drift_cnt = 0;
            if (g_cold_chain.current_temp >= 4.1f) drift_dir = -1;
            else if (g_cold_chain.current_temp <= 3.6f) drift_dir = 1;
            g_cold_chain.current_temp += (drift_dir * 0.1f);

            // Shift history periodically
            for (int i = 0; i < 11; i++) {
                g_cold_chain.temp_history[i] = g_cold_chain.temp_history[i + 1];
            }
            g_cold_chain.temp_history[11] = (int16_t)(g_cold_chain.current_temp * 10.0f);
            g_cold_chain.last_update_sec = 1;
        }
    }
}
