import { createVercelGatewayHandler } from "@kirari/edge-gateway-vercel";

const handleGatewayRequest = createVercelGatewayHandler();

export default {
	fetch(request: Request): Promise<Response> {
		return handleGatewayRequest(request);
	},
};
