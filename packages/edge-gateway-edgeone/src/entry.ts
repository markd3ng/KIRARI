import { createMakersGateway } from "./index.ts";
import { gatewayPolicy } from "./config.ts";

export const onRequest = createMakersGateway(gatewayPolicy);
export default onRequest;
