# SvelteKit High-Performance Node Adapter - Quick Start

This guide will help you integrate the adapter into your SvelteKit project.

## Installation

```bash
# If using this as a local package
npm install file:../adapter-node-rolldown

# Or if published to npm
npm install @sveltejs/adapter-node-rolldown
```

## Basic Setup

1. **Update svelte.config.js:**

```javascript
import adapter from '@sveltejs/adapter-node-rolldown';

export default {
  kit: {
    adapter: adapter({
      // Minimal configuration - all defaults work great
      out: 'build',
      precompress: true,
      compression: true,
      websocket: true,
      telemetry: true
    })
  }
};
```

2. **Build your app:**

```bash
npm run build
```

3. **Test locally:**

```bash
cd build
npm install
PORT=3000 node index.js
```

Visit http://localhost:3000 and verify:
- Main app works: http://localhost:3000
- Health check: http://localhost:3000/health
- Readiness: http://localhost:3000/readiness
- WebSocket: Connect to ws://localhost:3000/ws

## With OpenTelemetry/Dynatrace

1. **Get Dynatrace credentials:**
   - Environment ID: `abc12345` (from your Dynatrace URL)
   - API Token: Generate from Settings > Integration > Dynatrace API

2. **Create .env file:**

```bash
cp examples/.env.example .env
# Edit .env with your values
```

3. **Run with telemetry:**

```bash
cd build
npm install
source ../.env  # Load environment variables
node index.js
```

4. **Verify in Dynatrace:**
   - Go to Distributed Traces
   - Search for service name: "sveltekit-app"
   - See HTTP requests traced automatically

## Docker Deployment

1. **Build image:**

```bash
docker build -t my-sveltekit-app -f examples/Dockerfile .
```

2. **Run container:**

```bash
docker run -p 3000:3000 \
  -e OTEL_ENABLED=true \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=https://abc12345.live.dynatrace.com/api/v2/otlp/v1/traces \
  -e DYNATRACE_API_TOKEN=dt0c01.YOUR_TOKEN \
  my-sveltekit-app
```

3. **Or use docker-compose:**

```bash
# Set env vars first
export DYNATRACE_ENDPOINT="https://..."
export DYNATRACE_TOKEN="dt0c01...."

docker-compose -f examples/docker-compose.yml up
```

## Kubernetes Deployment

1. **Update examples/kubernetes.yaml:**
   - Replace `your-domain.com` with your domain
   - Replace `your-env-id` with your Dynatrace environment
   - Update image name

2. **Create secrets:**

```bash
kubectl create secret generic dynatrace-config \
  --from-literal=endpoint='https://abc12345.live.dynatrace.com/api/v2/otlp/v1/traces' \
  --from-literal=api-token='dt0c01.YOUR_TOKEN' \
  -n sveltekit-app
```

3. **Deploy:**

```bash
kubectl apply -f examples/kubernetes.yaml
```

4. **Verify:**

```bash
kubectl get pods -n sveltekit-app
kubectl logs -f deployment/sveltekit-app -n sveltekit-app
```

## AWS ECS Deployment

1. **Create ECR repository:**

```bash
aws ecr create-repository --repository-name sveltekit-app
```

2. **Build and push:**

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker build -t sveltekit-app -f examples/Dockerfile .
docker tag sveltekit-app:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/sveltekit-app:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/sveltekit-app:latest
```

3. **Create secrets in AWS Secrets Manager:**

```bash
aws secretsmanager create-secret \
  --name sveltekit/dynatrace-token \
  --secret-string "dt0c01.YOUR_TOKEN"

aws secretsmanager create-secret \
  --name sveltekit/dynatrace-endpoint \
  --secret-string "https://abc12345.live.dynatrace.com/api/v2/otlp/v1/traces"
```

4. **Update and register task definition:**

```bash
# Edit examples/ecs-task-definition.json with your values
aws ecs register-task-definition --cli-input-json file://examples/ecs-task-definition.json
```

5. **Create service:**

```bash
aws ecs create-service \
  --cluster your-cluster \
  --service-name sveltekit-app \
  --task-definition sveltekit-app \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

## WebSocket Usage

The adapter includes WebSocket support out of the box. Here's a simple example:

**Client-side (in your SvelteKit component):**

```javascript
<script>
  import { onMount } from 'svelte';
  
  let ws;
  let messages = [];
  
  onMount(() => {
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      console.log('Connected to WebSocket');
      ws.send(JSON.stringify({ type: 'hello', data: 'Hi server!' }));
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      messages = [...messages, message];
    };
    
    ws.onclose = () => {
      console.log('Disconnected from WebSocket');
    };
    
    return () => {
      if (ws) ws.close();
    };
  });
  
  function sendMessage(text) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', text }));
    }
  }
</script>

<div>
  <h2>WebSocket Messages</h2>
  {#each messages as msg}
    <p>{JSON.stringify(msg)}</p>
  {/each}
  
  <button on:click={() => sendMessage('Hello!')}>Send Message</button>
</div>
```

**Customize server-side WebSocket handling:**

Edit `build/server/index.js` after building to add custom WebSocket logic.

## Performance Tips

1. **Enable pre-compression** (default: true)
   - Generates .gz and .br files at build time
   - Serves pre-compressed files with zero CPU cost

2. **Tune compression level** (default: 6)
   - Lower (1-3): Faster, less compression
   - Higher (7-9): Slower, better compression

3. **Adjust body limits** (default: 10mb)
   - Increase if handling file uploads
   - Set to '50mb' or '100mb' as needed

4. **Sampling for high-traffic apps:**
   ```javascript
   adapter({
     telemetrySampleRate: 0.1  // Only trace 10% of requests
   })
   ```

5. **Keep-alive tuning:**
   ```bash
   KEEP_ALIVE_TIMEOUT=120000  # 2 minutes
   MAX_REQUESTS_PER_SOCKET=1000  # Reuse connections
   ```

## Troubleshooting

**Server won't start:**
- Check if port 3000 is available
- Verify all dependencies are installed in build/

**WebSocket connection fails:**
- Check if your reverse proxy supports WebSocket upgrades
- For NGINX: Add `proxy_http_version 1.1;`
- For ALB: Enable sticky sessions

**High memory usage:**
- Reduce OpenTelemetry sampling rate
- Disable telemetry in dev: `OTEL_ENABLED=false`

**Traces not appearing in Dynatrace:**
- Verify endpoint URL and API token
- Check logs for OpenTelemetry errors
- Ensure firewall allows outbound HTTPS to Dynatrace

## Next Steps

- Customize WebSocket behavior in `build/server/index.js`
- Add custom OpenTelemetry spans for business logic
- Set up monitoring dashboards in Dynatrace
- Configure autoscaling based on metrics
- Add custom middleware in `files/middlewares.js`

## Support

For issues and questions:
- Check the main README.md
- Review examples/ directory
- Check GitHub issues

Happy deploying! 🚀
