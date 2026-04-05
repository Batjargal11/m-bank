#!/bin/bash
# M-Bank Full API Test Script
# Tests every endpoint with example data

BASE="http://localhost:4000"
PASS=0
FAIL=0
TS=$(date +%s)

ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1: $2"; FAIL=$((FAIL+1)); }

test_endpoint() {
  local name="$1"
  local resp="$2"
  local success=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
  if [ "$success" = "True" ]; then
    ok "$name"
  else
    local err=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','unknown'))" 2>/dev/null)
    fail "$name" "$err"
  fi
  echo "$resp" > /dev/null
}

test_fail() {
  local name="$1"
  local resp="$2"
  local success=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
  if [ "$success" = "False" ]; then
    ok "$name (correctly rejected)"
  else
    fail "$name" "should have been rejected"
  fi
}

echo "╔══════════════════════════════════════════════════╗"
echo "║       M-BANK FULL API TEST SUITE                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

########################################
echo "━━━ 1. AUTH SERVICE ━━━"
########################################

echo ""
echo "POST /api/auth/login (maker_a)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"maker_a","password":"password123"}')
test_endpoint "Login maker_a" "$R"
TOKEN_MA=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

echo "POST /api/auth/login (user_b)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"user_b","password":"password123"}')
test_endpoint "Login user_b" "$R"
TOKEN_UB=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

echo "POST /api/auth/login (approver_b)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"approver_b","password":"password123"}')
test_endpoint "Login approver_b" "$R"
TOKEN_AB=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

echo "POST /api/auth/login (admin)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}')
test_endpoint "Login admin" "$R"
TOKEN_AD=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

echo "POST /api/auth/login (operator)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"operator","password":"password123"}')
test_endpoint "Login operator" "$R"
TOKEN_OP=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

echo "POST /api/auth/login (wrong password)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"maker_a","password":"wrong"}')
test_fail "Reject wrong password" "$R"

echo "POST /api/auth/login (nonexistent user)"
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"nobody","password":"test"}')
test_fail "Reject nonexistent user" "$R"

echo "GET /api/invoices (no auth)"
R=$(curl -s -m 5 $BASE/api/invoices)
test_fail "Reject no auth token" "$R"

########################################
echo ""
echo "━━━ 2. ORGANIZATIONS ━━━"
########################################

echo ""
echo "GET /api/organizations"
R=$(curl -s -m 5 $BASE/api/organizations -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "List organizations" "$R"
ORG_COUNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
echo "    → $ORG_COUNT байгууллага"

echo "GET /api/organizations/:id"
R=$(curl -s -m 5 $BASE/api/organizations/a0000000-0000-0000-0000-000000000001 -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Get org by ID" "$R"

echo "GET /api/organizations/:id/accounts"
R=$(curl -s -m 5 $BASE/api/organizations/a0000000-0000-0000-0000-000000000001/accounts -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Get org accounts" "$R"
ACC_COUNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
echo "    → $ACC_COUNT данс"

########################################
echo ""
echo "━━━ 3. INVOICE - CREATE ━━━"
########################################

echo ""
echo "POST /api/invoices (create draft)"
R=$(curl -s -m 10 -X POST $BASE/api/invoices -H "Authorization: Bearer $TOKEN_MA" -H "Content-Type: application/json" \
  -d '{
    "invoice_no": "TEST-'$TS'-001",
    "receiver_org_id": "b0000000-0000-0000-0000-000000000002",
    "issue_date": "2026-03-31",
    "due_date": "2026-04-30",
    "currency": "MNT",
    "vat_amount": 500000,
    "notes": "Тест нэхэмжлэх - бүрэн flow",
    "items": [
      {"description": "Серверийн хөгжүүлэлт", "quantity": 1, "unit_price": 3000000, "tax_amount": 300000},
      {"description": "Front-end хөгжүүлэлт", "quantity": 1, "unit_price": 2000000, "tax_amount": 200000},
      {"description": "QA тестинг", "quantity": 10, "unit_price": 100000, "tax_amount": 100000}
    ]
  }')
test_endpoint "Create invoice" "$R"
INV1=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['invoice_id'])" 2>/dev/null)
echo "    → ID: ${INV1:0:8}... Status: $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null) Total: $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['total_amount'])" 2>/dev/null)"

echo "POST /api/invoices (duplicate number)"
R=$(curl -s -m 5 -X POST $BASE/api/invoices -H "Authorization: Bearer $TOKEN_MA" -H "Content-Type: application/json" \
  -d '{"invoice_no":"TEST-'$TS'-001","receiver_org_id":"b0000000-0000-0000-0000-000000000002","issue_date":"2026-03-31","due_date":"2026-04-30","currency":"MNT","vat_amount":0,"items":[{"description":"X","quantity":1,"unit_price":1000,"tax_amount":0}]}')
test_fail "Reject duplicate invoice_no" "$R"

echo "POST /api/invoices (second invoice for cancel test)"
R=$(curl -s -m 10 -X POST $BASE/api/invoices -H "Authorization: Bearer $TOKEN_MA" -H "Content-Type: application/json" \
  -d '{"invoice_no":"TEST-'$TS'-002","receiver_org_id":"b0000000-0000-0000-0000-000000000002","issue_date":"2026-03-31","due_date":"2026-04-15","currency":"MNT","vat_amount":0,"items":[{"description":"Цуцлах тест","quantity":1,"unit_price":500000,"tax_amount":50000}]}')
test_endpoint "Create 2nd invoice" "$R"
INV2=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['invoice_id'])" 2>/dev/null)

echo "POST /api/invoices (third invoice for partial pay test)"
R=$(curl -s -m 10 -X POST $BASE/api/invoices -H "Authorization: Bearer $TOKEN_MA" -H "Content-Type: application/json" \
  -d '{"invoice_no":"TEST-'$TS'-003","receiver_org_id":"b0000000-0000-0000-0000-000000000002","issue_date":"2026-03-31","due_date":"2026-05-15","currency":"USD","vat_amount":100,"notes":"USD нэхэмжлэх","items":[{"description":"Консалтинг","quantity":5,"unit_price":200,"tax_amount":20}]}')
test_endpoint "Create USD invoice" "$R"
INV3=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['invoice_id'])" 2>/dev/null)

########################################
echo ""
echo "━━━ 4. INVOICE - READ ━━━"
########################################

echo ""
echo "GET /api/invoices?direction=sent"
R=$(curl -s -m 5 "$BASE/api/invoices?direction=sent" -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "List sent invoices" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('meta',{}).get('total','?'))" 2>/dev/null) нэхэмжлэх"

echo "GET /api/invoices?direction=received (Org B)"
R=$(curl -s -m 5 "$BASE/api/invoices?direction=received" -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "List received invoices" "$R"

echo "GET /api/invoices?direction=sent&status=DRAFT"
R=$(curl -s -m 5 "$BASE/api/invoices?direction=sent&status=DRAFT" -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Filter by status DRAFT" "$R"

echo "GET /api/invoices/:id"
R=$(curl -s -m 5 $BASE/api/invoices/$INV1 -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Get invoice detail" "$R"
ITEMS=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data'].get('items',[])))" 2>/dev/null)
echo "    → $ITEMS items"

echo "GET /api/invoices/stats"
R=$(curl -s -m 5 $BASE/api/invoices/stats -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Dashboard stats" "$R"

########################################
echo ""
echo "━━━ 5. INVOICE - SEND ━━━"
########################################

echo ""
echo "POST /api/invoices/:id/send (INV1)"
R=$(curl -s -m 10 -X POST $BASE/api/invoices/$INV1/send -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Send invoice" "$R"
echo "    → Status: $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)"

echo "POST /api/invoices/:id/send (INV2)"
R=$(curl -s -m 10 -X POST $BASE/api/invoices/$INV2/send -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Send 2nd invoice" "$R"

echo "POST /api/invoices/:id/send (already sent)"
R=$(curl -s -m 5 -X POST $BASE/api/invoices/$INV1/send -H "Authorization: Bearer $TOKEN_MA")
test_fail "Reject re-send" "$R"

########################################
echo ""
echo "━━━ 6. INVOICE - VIEW ━━━"
########################################

echo ""
echo "POST /api/invoices/:id/view (receiver views)"
R=$(curl -s -m 5 -X POST $BASE/api/invoices/$INV1/view -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "Receiver views invoice" "$R"
echo "    → Status: $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)"

echo "POST /api/invoices/:id/view (sender tries to view)"
R=$(curl -s -m 5 -X POST $BASE/api/invoices/$INV1/view -H "Authorization: Bearer $TOKEN_MA")
test_fail "Reject sender view" "$R"

########################################
echo ""
echo "━━━ 7. INVOICE - CANCEL ━━━"
########################################

echo ""
echo "POST /api/invoices/:id/cancel"
R=$(curl -s -m 5 -X POST $BASE/api/invoices/$INV2/cancel -H "Authorization: Bearer $TOKEN_MA" \
  -H "Content-Type: application/json" -d '{"reason":"Буруу дүн оруулсан"}')
test_endpoint "Cancel invoice" "$R"
echo "    → Status: $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)"

########################################
echo ""
echo "━━━ 8. INVOICE - HISTORY ━━━"
########################################

echo ""
echo "GET /api/invoices/:id/history"
R=$(curl -s -m 5 $BASE/api/invoices/$INV1/history -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Get status history" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; h=json.load(sys.stdin)['data']; print(len(h), 'entries:', ' → '.join([e['to_status'] for e in h]))" 2>/dev/null)"

########################################
echo ""
echo "━━━ 9. MOCK FINACLE ━━━"
########################################

echo ""
echo "POST /finacle/accounts/validate"
R=$(curl -s -m 5 -X POST http://localhost:4010/finacle/accounts/validate -H "Content-Type: application/json" \
  -d '{"account_no":"1001000001"}')
test_endpoint "Validate account (Org A MNT)" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['org_name'], d['currency'])" 2>/dev/null)"

echo "POST /finacle/accounts/validate (USD)"
R=$(curl -s -m 5 -X POST http://localhost:4010/finacle/accounts/validate -H "Content-Type: application/json" \
  -d '{"account_no":"1001000002"}')
test_endpoint "Validate account (Org A USD)" "$R"

echo "POST /finacle/accounts/validate (invalid)"
R=$(curl -s -m 5 -X POST http://localhost:4010/finacle/accounts/validate -H "Content-Type: application/json" \
  -d '{"account_no":"9999999999"}')
test_fail "Reject invalid account" "$R"

echo "POST /finacle/accounts/balance"
R=$(curl -s -m 5 -X POST http://localhost:4010/finacle/accounts/balance -H "Content-Type: application/json" \
  -d '{"account_no":"2001000001"}')
test_endpoint "Check balance (Org B MNT)" "$R"
echo "    → Balance: $(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('{:,.0f}'.format(d['balance']), d['currency'])" 2>/dev/null)"

echo "POST /finacle/accounts/balance (Org B USD)"
R=$(curl -s -m 5 -X POST http://localhost:4010/finacle/accounts/balance -H "Content-Type: application/json" \
  -d '{"account_no":"2001000002"}')
test_endpoint "Check balance (Org B USD)" "$R"
echo "    → Balance: $(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('{:,.0f}'.format(d['balance']), d['currency'])" 2>/dev/null)"

echo "POST /finacle/transfer"
R=$(curl -s -m 5 -X POST http://localhost:4010/finacle/transfer -H "Content-Type: application/json" \
  -d '{"debit_account":"2001000001","credit_account":"1001000001","amount":100000,"currency":"MNT","reference":"TEST-TXN-001"}')
test_endpoint "Direct transfer test" "$R"
TXN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['txn_ref'])" 2>/dev/null)
echo "    → Txn ref: $TXN"

echo "GET /finacle/transactions/:ref"
R=$(curl -s -m 5 http://localhost:4010/finacle/transactions/$TXN)
test_endpoint "Get transaction status" "$R"

########################################
echo ""
echo "━━━ 10. MOCK E-INVOICE ━━━"
########################################

echo ""
echo "POST /einvoice/invoices (register)"
R=$(curl -s -m 5 -X POST http://localhost:4011/einvoice/invoices -H "Content-Type: application/json" \
  -d '{"invoice_no":"TEST-001","sender":"Org A","receiver":"Org B","amount":5000000,"currency":"MNT"}')
test_endpoint "Register e-invoice" "$R"
EREF=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['einvoice_ref'])" 2>/dev/null)
echo "    → Ref: $EREF"

echo "GET /einvoice/invoices/:ref/status"
R=$(curl -s -m 5 http://localhost:4011/einvoice/invoices/$EREF/status)
test_endpoint "Get e-invoice status" "$R"

echo "PUT /einvoice/invoices/:ref/cancel"
R=$(curl -s -m 5 -X PUT http://localhost:4011/einvoice/invoices/$EREF/cancel -H "Content-Type: application/json" \
  -d '{"reason":"Test cancel"}')
test_endpoint "Cancel e-invoice" "$R"

########################################
echo ""
echo "━━━ 11. INTEGRATION SERVICE ━━━"
########################################

echo ""
echo "POST /internal/finacle/validate-account"
R=$(curl -s -m 5 -X POST http://localhost:4006/internal/finacle/validate-account -H "Content-Type: application/json" \
  -d '{"account_no":"1001000001"}')
test_endpoint "Integration validate account" "$R"

echo "POST /internal/finacle/check-balance"
R=$(curl -s -m 5 -X POST http://localhost:4006/internal/finacle/check-balance -H "Content-Type: application/json" \
  -d '{"account_no":"2001000001"}')
test_endpoint "Integration check balance" "$R"

########################################
echo ""
echo "━━━ 12. PAYMENT - CREATE ━━━"
########################################

echo ""
echo "POST /api/payments (Org B pays INV1)"
R=$(curl -s -m 10 -X POST $BASE/api/payments -H "Authorization: Bearer $TOKEN_UB" -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-pay-$TS" \
  -d "{\"invoice_id\":\"$INV1\",\"payer_account\":\"2001000001\",\"amount\":6600000,\"currency\":\"MNT\"}")
test_endpoint "Create payment" "$R"
PAY1=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['payment_id'] if d['success'] else '')" 2>/dev/null)
echo "    → Payment: ${PAY1:0:8}... Status: $(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['payment_status'])" 2>/dev/null)"

echo "POST /api/payments (idempotency test - same key)"
R=$(curl -s -m 10 -X POST $BASE/api/payments -H "Authorization: Bearer $TOKEN_UB" -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-pay-$TS" \
  -d "{\"invoice_id\":\"$INV1\",\"payer_account\":\"2001000001\",\"amount\":6600000,\"currency\":\"MNT\"}")
test_endpoint "Idempotency (same key returns cached)" "$R"

echo "   Waiting for Finacle processing (3s)..."
sleep 3

########################################
echo ""
echo "━━━ 13. PAYMENT - READ ━━━"
########################################

echo ""
echo "GET /api/payments"
R=$(curl -s -m 5 $BASE/api/payments -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "List payments" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']), 'payments')" 2>/dev/null)"

echo "GET /api/payments/:id"
R=$(curl -s -m 5 $BASE/api/payments/$PAY1 -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "Get payment detail" "$R"
PSTATUS=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['payment_status'])" 2>/dev/null)
FTXN=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('finacle_txn_ref','N/A'))" 2>/dev/null)
echo "    → Status: $PSTATUS, Finacle: $FTXN"

echo "GET /api/payments/by-invoice/:invoiceId"
R=$(curl -s -m 5 $BASE/api/payments/by-invoice/$INV1 -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "Get payments by invoice" "$R"

########################################
echo ""
echo "━━━ 14. INVOICE AFTER PAYMENT ━━━"
########################################

echo ""
echo "GET /api/invoices/:id (check paid status)"
R=$(curl -s -m 5 $BASE/api/invoices/$INV1 -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "Invoice after payment" "$R"
echo "    → Status: $(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['status'], 'paid:', d['paid_amount'], 'outstanding:', d['outstanding_amount'])" 2>/dev/null)"

########################################
echo ""
echo "━━━ 15. NOTIFICATIONS ━━━"
########################################

echo ""
echo "GET /api/notifications (Org B)"
R=$(curl -s -m 5 $BASE/api/notifications -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "List notifications" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']), 'notifications')" 2>/dev/null)"

echo "GET /api/notifications/unread-count"
R=$(curl -s -m 5 $BASE/api/notifications/unread-count -H "Authorization: Bearer $TOKEN_UB")
test_endpoint "Unread count" "$R"

########################################
echo ""
echo "━━━ 16. AUDIT LOGS ━━━"
########################################

echo ""
echo "GET /api/audit/logs (admin)"
R=$(curl -s -m 5 "$BASE/api/audit/logs" -H "Authorization: Bearer $TOKEN_AD")
test_endpoint "List audit logs" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']), 'entries')" 2>/dev/null)"

echo "GET /api/audit/integration-logs (admin)"
R=$(curl -s -m 5 "$BASE/api/audit/integration-logs" -H "Authorization: Bearer $TOKEN_AD")
test_endpoint "List integration logs" "$R"

echo "GET /api/audit/logs (non-admin should fail)"
R=$(curl -s -m 5 "$BASE/api/audit/logs" -H "Authorization: Bearer $TOKEN_UB")
test_fail "Reject non-admin audit access" "$R"

########################################
echo ""
echo "━━━ 17. USERS ━━━"
########################################

echo ""
echo "GET /api/users (admin)"
R=$(curl -s -m 5 $BASE/api/users -H "Authorization: Bearer $TOKEN_AD")
test_endpoint "List users" "$R"
echo "    → $(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']), 'users')" 2>/dev/null)"

########################################
echo ""
echo "━━━ 18. CROSS-ORG ACCESS CONTROL ━━━"
########################################

echo ""
echo "DELETE /api/invoices/:id (delete DRAFT from wrong org)"
# Create invoice from Org B maker first
R=$(curl -s -m 5 -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"maker_b","password":"password123"}')
TOKEN_MB=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

R=$(curl -s -m 10 -X POST $BASE/api/invoices -H "Authorization: Bearer $TOKEN_MB" -H "Content-Type: application/json" \
  -d '{"invoice_no":"ORGB-'$TS'","receiver_org_id":"a0000000-0000-0000-0000-000000000001","issue_date":"2026-03-31","due_date":"2026-04-30","currency":"MNT","vat_amount":0,"items":[{"description":"Org B тест","quantity":1,"unit_price":2000000,"tax_amount":200000}]}')
test_endpoint "Org B creates invoice" "$R"
INV_B=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['invoice_id'])" 2>/dev/null)

echo "DELETE (Org A tries to delete Org B's invoice)"
R=$(curl -s -m 5 -X DELETE $BASE/api/invoices/$INV_B -H "Authorization: Bearer $TOKEN_MA")
test_fail "Reject cross-org delete" "$R"

echo "POST send (Org B sends to Org A)"
R=$(curl -s -m 10 -X POST $BASE/api/invoices/$INV_B/send -H "Authorization: Bearer $TOKEN_MB")
test_endpoint "Org B sends invoice to Org A" "$R"

echo "GET received (Org A sees Org B's invoice)"
R=$(curl -s -m 5 "$BASE/api/invoices?direction=received" -H "Authorization: Bearer $TOKEN_MA")
test_endpoint "Org A sees received invoices" "$R"

########################################
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║                 TEST RESULTS                     ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  ✅ Passed: $PASS                                "
echo "║  ❌ Failed: $FAIL                                "
echo "║  Total:  $((PASS+FAIL))                          "
echo "╚══════════════════════════════════════════════════╝"
