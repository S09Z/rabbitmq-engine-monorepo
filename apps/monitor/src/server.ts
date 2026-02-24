import { Elysia } from "elysia";
import { publish } from "@repo/rabbit/publisher";
import { config } from "@repo/config";

const QUEUES = ["job.queue", "job.retry.queue", "job.dlq"];

function mgmtAuthHeader(): string {
  const credentials = btoa(`${config.rabbitMgmtUser}:${config.rabbitMgmtPass}`);
  return `Basic ${credentials}`;
}

async function fetchQueueStats(queueName: string) {
  const encoded = encodeURIComponent(queueName);
  const url = `${config.rabbitMgmtUrl}/api/queues/%2F/${encoded}`;
  const res = await fetch(url, {
    headers: { Authorization: mgmtAuthHeader() },
  });
  if (!res.ok) {
    return {
      name: queueName,
      messages_ready: 0,
      messages_unacknowledged: 0,
      messages: 0,
      consumers: 0,
    };
  }
  const q = (await res.json()) as {
    messages_ready?: number;
    messages_unacknowledged?: number;
    messages?: number;
    consumers?: number;
  };
  return {
    name: queueName,
    messages_ready: q.messages_ready ?? 0,
    messages_unacknowledged: q.messages_unacknowledged ?? 0,
    messages: q.messages ?? 0,
    consumers: q.consumers ?? 0,
  };
}

async function fetchChannels() {
  const url = `${config.rabbitMgmtUrl}/api/channels`;
  const res = await fetch(url, {
    headers: { Authorization: mgmtAuthHeader() },
  });
  if (!res.ok) return [];
  const channels = (await res.json()) as Array<{
    name?: string;
    consumer_count?: number;
    prefetch_count?: number;
    state?: string;
  }>;
  return channels.map((ch) => ({
    name: ch.name ?? "unknown",
    consumer_count: ch.consumer_count ?? 0,
    prefetch_count: ch.prefetch_count ?? 0,
    state: ch.state ?? "unknown",
  }));
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RabbitMQ Monitor</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; }
    header { background: #1a1d27; border-bottom: 1px solid #2d3148; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    header h1 { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.01em; }
    .live-badge { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #94a3b8; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    main { padding: 24px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
    section h2 { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 14px; }
    .queue-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .card { background: #1a1d27; border: 1px solid #2d3148; border-radius: 10px; padding: 18px 20px; }
    .card-title { font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px; font-weight: 500; }
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .stat-label { font-size: 0.78rem; color: #64748b; }
    .stat-value { font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .stat-value.ready { color: #60a5fa; }
    .stat-value.unacked { color: #f59e0b; }
    .stat-value.consumers { color: #34d399; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    thead th { text-align: left; padding: 8px 12px; color: #64748b; font-weight: 500; border-bottom: 1px solid #2d3148; }
    tbody tr:hover { background: #1e2235; }
    tbody td { padding: 9px 12px; border-bottom: 1px solid #1e2235; color: #cbd5e1; }
    .state-running { color: #34d399; }
    .state-idle { color: #94a3b8; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field.full { grid-column: 1 / -1; }
    label { font-size: 0.78rem; color: #64748b; font-weight: 500; }
    input, textarea { background: #1a1d27; border: 1px solid #2d3148; border-radius: 6px; color: #e2e8f0; font-size: 0.85rem; padding: 8px 12px; outline: none; transition: border-color 0.15s; font-family: inherit; }
    input:focus, textarea:focus { border-color: #6366f1; }
    textarea { resize: vertical; min-height: 90px; font-family: 'Courier New', monospace; font-size: 0.8rem; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; align-items: center; }
    button { background: #6366f1; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    button:hover { background: #4f46e5; }
    button:active { background: #4338ca; }
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 500; opacity: 0; transform: translateY(10px); transition: all 0.25s; pointer-events: none; z-index: 99; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.success { background: #166534; color: #bbf7d0; border: 1px solid #15803d; }
    .toast.error { background: #7f1d1d; color: #fecaca; border: 1px solid #991b1b; }
    .empty-row td { color: #475569; text-align: center; padding: 20px; }
    #last-updated { font-size: 0.75rem; color: #475569; }
  </style>
</head>
<body>
  <header>
    <h1>RabbitMQ Monitor</h1>
    <div class="live-badge">
      <span id="last-updated">—</span>
      <span>auto-refresh 3s</span>
      <span class="dot"></span>
      <span>live</span>
    </div>
  </header>

  <main>
    <section>
      <h2>Queue Stats</h2>
      <div class="queue-cards" id="queue-cards">
        <div class="card"><div class="card-title">Loading…</div></div>
      </div>
    </section>

    <section>
      <h2>Active Channels</h2>
      <table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Consumers</th>
            <th>Prefetch</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody id="channels-body">
          <tr class="empty-row"><td colspan="4">Loading…</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Publish Test Job</h2>
      <form id="publish-form">
        <div class="form-grid">
          <div class="form-field">
            <label for="jobId">Job ID</label>
            <input type="text" id="jobId" name="jobId" placeholder="auto-generated" />
          </div>
          <div class="form-field">
            <label for="userId">User ID</label>
            <input type="text" id="userId" name="userId" placeholder="user-123" required />
          </div>
          <div class="form-field full">
            <label for="data">Data (JSON)</label>
            <textarea id="data" name="data" placeholder='{ "task": "example" }'></textarea>
          </div>
        </div>
        <div class="form-actions" style="margin-top:14px">
          <span id="publish-status" style="font-size:0.8rem;color:#64748b"></span>
          <button type="submit">Publish Job</button>
        </div>
      </form>
    </section>
  </main>

  <div class="toast" id="toast"></div>

  <script>
    function uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }

    document.getElementById('jobId').value = uuid();

    function showToast(msg, type) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type;
      void t.offsetWidth;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    function renderQueues(queues) {
      const container = document.getElementById('queue-cards');
      container.innerHTML = queues.map(q => \`
        <div class="card">
          <div class="card-title">\${q.name}</div>
          <div class="stat-row">
            <span class="stat-label">Ready</span>
            <span class="stat-value ready">\${q.messages_ready}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Unacked</span>
            <span class="stat-value unacked">\${q.messages_unacknowledged}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Consumers</span>
            <span class="stat-value consumers">\${q.consumers}</span>
          </div>
        </div>
      \`).join('');
    }

    function renderChannels(channels) {
      const tbody = document.getElementById('channels-body');
      if (!channels.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No active channels</td></tr>';
        return;
      }
      tbody.innerHTML = channels.map(ch => \`
        <tr>
          <td>\${ch.name}</td>
          <td>\${ch.consumer_count}</td>
          <td>\${ch.prefetch_count}</td>
          <td class="state-\${ch.state}">\${ch.state}</td>
        </tr>
      \`).join('');
    }

    async function refresh() {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        renderQueues(data.queues);
        renderChannels(data.channels);
        const now = new Date();
        document.getElementById('last-updated').textContent =
          'updated ' + now.toLocaleTimeString();
      } catch (e) {
        console.error('Stats refresh failed', e);
      }
    }

    refresh();
    setInterval(refresh, 3000);

    document.getElementById('publish-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const jobId = document.getElementById('jobId').value.trim() || uuid();
      const userId = document.getElementById('userId').value.trim();
      const rawData = document.getElementById('data').value.trim() || '{}';

      let data;
      try {
        data = JSON.parse(rawData);
      } catch {
        showToast('Invalid JSON in Data field', 'error');
        return;
      }

      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, userId, data }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'publish failed');
        showToast('Job published: ' + jobId, 'success');
        document.getElementById('jobId').value = uuid();
      } catch (err) {
        showToast('Publish failed: ' + err.message, 'error');
      }
    });
  </script>
</body>
</html>`;

export const app = new Elysia()
  .get("/", () =>
    new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  )
  .get("/api/stats", async () => {
    const [queues, channels] = await Promise.all([
      Promise.all(QUEUES.map(fetchQueueStats)),
      fetchChannels(),
    ]);
    return { queues, channels };
  })
  .post("/api/publish", async ({ body, set }) => {
    const { jobId, userId, data } = body as {
      jobId?: string;
      userId?: string;
      data?: unknown;
    };

    if (!userId) {
      set.status = 400;
      return { error: "userId is required" };
    }

    const resolvedJobId = jobId ?? crypto.randomUUID();

    await publish("job.create", { jobId: resolvedJobId, userId, data: data ?? {} });

    set.status = 202;
    return { status: "queued", jobId: resolvedJobId };
  });
