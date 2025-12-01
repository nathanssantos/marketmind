#!/bin/bash

echo "🚀 Testing MarketMind Backend API"
echo ""

echo "📡 Testing health.ping endpoint..."
curl -X GET "http://localhost:3001/trpc/health.ping" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.' || echo "❌ Failed"

echo ""
echo ""

echo "📡 Testing health.check endpoint..."
curl -X GET "http://localhost:3001/trpc/health.check" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.' || echo "❌ Failed"

echo ""
echo ""

echo "📡 Testing auth.register endpoint..."
curl -X POST "http://localhost:3001/trpc/auth.register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}' \
  2>/dev/null | jq '.' || echo "❌ Failed"

echo ""
echo "✅ Tests completed"
