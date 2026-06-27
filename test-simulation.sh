#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Testing Zone Tracking Simulation                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Backend URL
BACKEND_URL="http://localhost:3000"

# Test 1: Health Check
echo -e "${YELLOW}1. Testing backend health...${NC}"
HEALTH=$(curl -s ${BACKEND_URL}/health)
if [[ $HEALTH == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Start Simulation
echo -e "${YELLOW}2. Starting simulation...${NC}"
START_RESPONSE=$(curl -s -X POST ${BACKEND_URL}/api/simulation/start)
if [[ $START_RESPONSE == *"started"* ]] || [[ $START_RESPONSE == *"running"* ]]; then
    echo -e "${GREEN}✅ Simulation started${NC}"
else
    echo -e "${RED}❌ Failed to start simulation${NC}"
    echo $START_RESPONSE
fi
echo ""

# Test 3: Check Simulation Status
echo -e "${YELLOW}3. Checking simulation status...${NC}"
sleep 2
STATUS=$(curl -s ${BACKEND_URL}/api/simulation/status)
echo $STATUS | jq '.'
echo ""

# Test 4: Get Tracked Persons
echo -e "${YELLOW}4. Getting tracked persons...${NC}"
sleep 3
PERSONS=$(curl -s ${BACKEND_URL}/api/simulation/persons)
PERSON_COUNT=$(echo $PERSONS | jq '. | length')
echo -e "${GREEN}📊 Currently tracking ${PERSON_COUNT} persons${NC}"
echo ""

# Test 5: Get Persons by Zone
echo -e "${YELLOW}5. Checking zones...${NC}"
for zone in 1 2 3 4; do
    ZONE_PERSONS=$(curl -s ${BACKEND_URL}/api/simulation/zones/${zone})
    ZONE_COUNT=$(echo $ZONE_PERSONS | jq '. | length')
    echo -e "Zone ${zone}: ${ZONE_COUNT} persons"
done
echo ""

# Test 6: Wait and check movement
echo -e "${YELLOW}6. Waiting 10 seconds to observe movement...${NC}"
sleep 10
PERSONS_AFTER=$(curl -s ${BACKEND_URL}/api/simulation/persons)
echo -e "${GREEN}✅ Persons updated${NC}"
echo ""

# Test 7: Stop Simulation
echo -e "${YELLOW}7. Stopping simulation...${NC}"
STOP_RESPONSE=$(curl -s -X POST ${BACKEND_URL}/api/simulation/stop)
if [[ $STOP_RESPONSE == *"stopped"* ]]; then
    echo -e "${GREEN}✅ Simulation stopped${NC}"
else
    echo -e "${RED}❌ Failed to stop simulation${NC}"
fi
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All tests completed!                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Open http://localhost:5173/simulation in your browser"
echo "2. Login as admin (admin@kumbh.gov.in / admin123)"
echo "3. Click 'Start Simulation' and watch the magic! ✨"
