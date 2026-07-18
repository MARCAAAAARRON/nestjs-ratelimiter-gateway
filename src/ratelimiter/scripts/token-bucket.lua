-- KEYS[1] = bucket key
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp (ms, passed in from Node so Lua stays deterministic)

local bucketKey = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call("HMGET", bucketKey, "tokens", "lastRefill")
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
  -- bucket doesn't exist yet — start full
  tokens = capacity
  lastRefill = now
end

-- how much time has passed, and how many tokens should that add back?
local elapsedSeconds = (now - lastRefill) / 1000
local refillAmount = elapsedSeconds * refillRate
tokens = math.min(capacity, tokens + refillAmount)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call("HMSET", bucketKey, "tokens", tokens, "lastRefill", now)
redis.call("EXPIRE", bucketKey, 3600) -- safety cleanup if key goes unused for an hour

return allowed