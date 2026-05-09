export interface MapInfo {
  watts: number;
  computedFrom: {
    metric: "best_60s";
    activityId: number | string;
    activityName: string;
    activityDate: string;
    daysAgo: number;
  };
}

export interface MapDerivation {
  map: MapInfo | null;
  mapWarning?: string;
}
