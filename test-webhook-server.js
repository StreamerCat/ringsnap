// Simple webhook test server
import http from 'http';

const PORT = 3001;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log('\n' + '='.repeat(60));
      console.log('📥 WEBHOOK RECEIVED at', new Date().toISOString());
      console.log('='.repeat(60));
      console.log('\n📋 Headers:');
      console.log(JSON.stringify(req.headers, null, 2));
      console.log('\n📦 Body:');

      try {
        const parsed = JSON.parse(body);
        console.log(JSON.stringify(parsed, null, 2));

        // Log event type if it's a Stripe webhook
        if (parsed.type) {
          console.log('\n🎯 Event Type:', parsed.type);
        }
      } catch (e) {
        console.log(body);
      }

      console.log('\n' + '='.repeat(60) + '\n');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1>🎣 Webhook Test Server Running</h1>
          <p>Server is listening on port ${PORT}</p>
          <p>Send POST requests to test webhooks</p>
          <h2>Test it with curl:</h2>
          <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
curl -X POST http://localhost:${PORT}/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"test": "data"}'
          </pre>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log('🚀 Webhook test server running');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`\n💡 To test with Stripe CLI (when installed):`);
  console.log(`   stripe listen --forward-to localhost:${PORT}/webhook\n`);
  console.log('⏳ Waiting for webhooks...\n');
});
