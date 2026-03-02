const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

export async function queryAgent(question) {
  return request('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}

export async function getStats() {
  return request('/stats')
}

export async function getDirectors() {
  return request('/directors')
}

export async function getHealth() {
  return request('/health')
}

export async function exploreNode(name, depth = 1) {
  return request(`/explore/${encodeURIComponent(name)}?depth=${depth}`)
}
