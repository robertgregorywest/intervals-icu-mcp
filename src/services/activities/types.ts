export interface Activity {
  id: string;
  start_date_local: string;
  type: string;
  name: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  total_elevation_gain: number;
  icu_ftp: number;
  icu_weighted_avg_watts: number;
  icu_average_watts: number;
  average_heartrate: number;
  max_heartrate: number;
  icu_intensity: number;
  icu_training_load: number;
  icu_variability_index: number;
  icu_efficiency_factor: number;
  average_cadence: number;
  max_watts: number;
  icu_intervals: ActivityInterval[];
  [key: string]: unknown;
}

export interface ActivityInterval {
  id: number;
  label: string;
  start_index: number;
  end_index: number;
  elapsed: number;
  distance: number;
  avg_watts: number;
  max_watts: number;
  avg_hr: number;
  max_hr: number;
  avg_cadence: number;
  [key: string]: unknown;
}

export interface ActivityStreams {
  watts?: number[];
  heartrate?: number[];
  cadence?: number[];
  time?: number[];
  velocity_smooth?: number[];
  altitude?: number[];
  latlng?: number[][];
  [key: string]: unknown;
}
