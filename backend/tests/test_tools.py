from datetime import date
from app.models import Transaction
from app.tools import detect_stealth_hikes, calculate_annual_leakage, generate_cancellation_script
from app.sample_data import sample_transactions

def test_sample_contains_expected_price_hike():
    findings = detect_stealth_hikes(sample_transactions())
    assert len(findings) == 1
    hike = findings[0]
    assert hike["merchant"] == "StreamBox Premium"
    assert hike["old_amount"] == 37.69
    assert hike["new_amount"] == 49.00
    assert hike["change_pct"] == 30.0

def test_annual_cost():
    res = calculate_annual_leakage("StreamBox Premium", 49.0)
    assert res["annual_cost"] == 588.0

def test_draft_is_not_sent():
    res = generate_cancellation_script("StreamBox Premium", 37.69, 49.0)
    assert res["sent"] is False
    assert "$11.31" in res["draft"]

def test_spotify_flat_no_hike():
    spotify_txs = [
        Transaction(merchant="Spotify", date=date(2026, 6, 14), category="Subscriptions", amount=11.99),
        Transaction(merchant="Spotify", date=date(2026, 7, 14), category="Subscriptions", amount=11.99)
    ]
    findings = detect_stealth_hikes(spotify_txs)
    assert len(findings) == 0
