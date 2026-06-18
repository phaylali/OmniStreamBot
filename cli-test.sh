#!/bin/bash

PORT=9999
BASE_URL="http://localhost:$PORT/api"

echo "Omniversify Studio CLI Tester"
echo "============================="

if [ "$1" == "simulate" ]; then
    echo "Simulating chat message..."
    curl -X POST "$BASE_URL/chat/simulate" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$2\", \"message\": \"$3\"}"
    echo ""
elif [ "$1" == "tts-test" ]; then
    echo "Testing TTS..."
    curl -X POST "$BASE_URL/tts/test" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$2\"}"
    echo ""
elif [ "$1" == "tts-clear" ]; then
    echo "Clearing TTS Queue..."
    curl -X POST "$BASE_URL/tts/clear"
    echo ""
elif [ "$1" == "status" ]; then
    echo "Fetching TTS Status..."
    curl -s "$BASE_URL/tts/status" | jq . || curl -s "$BASE_URL/tts/status"
    echo ""
else
    echo "Usage:"
    echo "  ./cli-test.sh simulate <username> <message>"
    echo "  ./cli-test.sh tts-test \"<text to speak>\""
    echo "  ./cli-test.sh tts-clear"
    echo "  ./cli-test.sh status"
    echo ""
    echo "Example:"
    echo "  ./cli-test.sh simulate testuser \"Hello world!\""
fi
