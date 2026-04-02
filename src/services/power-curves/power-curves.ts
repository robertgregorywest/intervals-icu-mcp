import type { IHttpClient } from "../../client.js";
import type { PowerCurvePoint } from "./types.js";

export interface PowerCurveOptions {
  type?: string;
  range?: string;
}

export interface IPowerCurvesApi {
  getPowerCurve(options?: PowerCurveOptions): Promise<PowerCurvePoint[]>;
}

export class PowerCurvesApi implements IPowerCurvesApi {
  private httpClient: IHttpClient;
  private athleteId: string;

  constructor(httpClient: IHttpClient, athleteId: string) {
    this.httpClient = httpClient;
    this.athleteId = athleteId;
  }

  async getPowerCurve(
    options: PowerCurveOptions = {}
  ): Promise<PowerCurvePoint[]> {
    const params = new URLSearchParams();
    if (options.type) params.set("type", options.type);
    if (options.range) params.set("curves", options.range);
    const query = params.toString();
    return this.httpClient.request<PowerCurvePoint[]>(
      `/api/v1/athlete/${this.athleteId}/power-curves-ext${query ? `?${query}` : ""}`
    );
  }
}

export function createPowerCurvesApi(
  httpClient: IHttpClient,
  athleteId: string
): PowerCurvesApi {
  return new PowerCurvesApi(httpClient, athleteId);
}
