from datetime import date
from .models import Transaction, Category

def sample_transactions() -> list[Transaction]:
    return [
        Transaction(merchant="Campus Cafe", date=date(2026, 6, 5), category="Dining", amount=8.50, raw_line="SQ *CAMPUS CAFE 8.50"),
        Transaction(merchant="StreamBox Premium", date=date(2026, 6, 3), category="Subscriptions", amount=37.69, raw_line="STREAMBOX*PREM 37.69"),
        Transaction(merchant="Groceries Market", date=date(2026, 6, 8), category="Shopping", amount=42.10, raw_line="POS GROCERIES MARKET 42.10"),
        Transaction(merchant="Spotify", date=date(2026, 6, 14), category="Subscriptions", amount=11.99, raw_line="TST* SPOTIFY USA 11.99"),
        Transaction(merchant="StreamBox Premium", date=date(2026, 7, 3), category="Subscriptions", amount=37.69, raw_line="STREAMBOX*PREM 37.69"),
        Transaction(merchant="Campus Cafe", date=date(2026, 7, 6), category="Dining", amount=9.25, raw_line="SQ *CAMPUS CAFE 9.25"),
        Transaction(merchant="Spotify", date=date(2026, 7, 14), category="Subscriptions", amount=11.99, raw_line="TST* SPOTIFY USA 11.99"),
        Transaction(merchant="StreamBox Premium", date=date(2026, 8, 3), category="Subscriptions", amount=49.00, raw_line="STREAMBOX*PREM 49.00"),
        Transaction(merchant="Groceries Market", date=date(2026, 8, 8), category="Shopping", amount=39.40, raw_line="POS GROCERIES MARKET 39.40"),
        Transaction(merchant="Spotify", date=date(2026, 8, 14), category="Subscriptions", amount=11.99, raw_line="TST* SPOTIFY USA 11.99"),
        Transaction(merchant="Fuel Station", date=date(2026, 8, 17), category="Fuel", amount=25.00, raw_line="POS FUEL STATION 25.00"),
        Transaction(merchant="StreamBox Premium", date=date(2026, 9, 3), category="Subscriptions", amount=49.00, raw_line="STREAMBOX*PREM 49.00"),
        Transaction(merchant="Spotify", date=date(2026, 9, 14), category="Subscriptions", amount=11.99, raw_line="TST* SPOTIFY USA 11.99"),
        Transaction(merchant="Food Delivery", date=date(2026, 9, 18), category="Food delivery", amount=18.75, raw_line="UPI/FOOD DELIVERY/8231 18.75"),
    ]
