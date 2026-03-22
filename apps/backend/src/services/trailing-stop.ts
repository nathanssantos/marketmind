export {
    calculateAutoStopOffset,
    calculateATRTrailingStop,
    calculateProfitPercent,
    calculateProgressiveFloor,
    computeTrailingStop,
    DEFAULT_TRAILING_STOP_CONFIG,
    findBestSwingStop,
    resolveTrailingStopConfig,
    shouldUpdateStopLoss,
    type TrailingStopInput,
    type TrailingStopResult,
    type TrailingStopUpdate,
} from './trailing-stop-config';

export { TrailingStopService, trailingStopService } from './trailing-stop-service';
