#ifndef COLD_CHAIN_CONTROLLER_H
#define COLD_CHAIN_CONTROLLER_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdbool.h>
#include <stdint.h>

typedef enum {
    BATCH_STATUS_REVIEW_REQUIRED = 0,
    BATCH_STATUS_RELEASED        = 1,
    BATCH_STATUS_HOLD            = 2,
    BATCH_STATUS_EXCURSION       = 3
} batch_status_t;

typedef struct {
    float current_temp;            // Temperature in deg C
    float min_temp_limit;          // Standard 2.0 C
    float max_temp_limit;          // Standard 8.0 C
    float current_humidity;        // RH in %
    bool sensor_connected;         // Sensor online flag
    bool is_simulated;             // Real vs Simulated telemetry tag
    uint32_t last_update_sec;      // Seconds elapsed since last reading

    const char *shipment_id;       // "SHP-2024-IN-882"
    const char *batch_id;          // "B-7749"
    const char *product_name;      // "Covaxin Inactivated Vaccine (0.5ml)"
    const char *expiry_date;       // "2027-08-31"
    const char *checkpoint;        // "Depot Hub 3 -> Dispenser Unit 04"
    const char *gps_coord;         // "28.6139 N, 77.2090 E"
    bool gps_simulated;

    int excursion_count;           // Count of recorded excursion breaches
    batch_status_t batch_status;   // Release / Hold / Review Required
    const char *batch_status_reason;

    int16_t temp_history[12];      // Scaled x10 (e.g., 38 for 3.8 deg C)
} cold_chain_state_t;

extern cold_chain_state_t g_cold_chain;

void cold_chain_init(void);
bool cold_chain_is_dispense_allowed(void);
const char* cold_chain_get_batch_status_str(void);
const char* cold_chain_get_dispense_lock_reason(void);
void cold_chain_set_batch_status(batch_status_t new_status, const char *reason);
void cold_chain_update_telemetry(float temp, float humidity, bool is_real_sensor);
void cold_chain_tick(void);

#ifdef __cplusplus
}
#endif

#endif // COLD_CHAIN_CONTROLLER_H
