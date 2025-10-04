-- Very low cardinality FKs
CREATE BITMAP INDEX idx_bi_fk_rpl_location_id ON FACT_EOD_RISK (RPL_LOCATION_ID);  -- 50 distinct
CREATE BITMAP INDEX idx_bi_fk_rpl_subsidiary_id ON FACT_EOD_RISK (RPL_SUBSIDIARY_ID);  -- 110 distinct
CREATE BITMAP INDEX idx_bi_fk_rpl_unit_id ON FACT_EOD_RISK (RPL_UNIT_ID);  -- 4455 distinct
CREATE BITMAP INDEX idx_bi_fk_pkg_id ON FACT_EOD_RISK (PKG_ID);  -- 18 distinct
CREATE BITMAP INDEX idx_bi_fk_source_exp_seq_id ON FACT_EOD_RISK (SOURCE_EXP_SEQ_ID);  -- 18 distinct
CREATE BITMAP INDEX idx_bi_fk_dsloadid ON FACT_EOD_RISK (DSLOADID);  -- 18 distinct
CREATE BITMAP INDEX idx_bi_fk_risk_type_code ON FACT_EOD_RISK (RISK_TYPE_CODE);  -- 130 distinct
CREATE BITMAP INDEX idx_bi_fk_risk_factor_country_code ON FACT_EOD_RISK (RISK_FACTOR_COUNTRY_CODE);  -- 142 distinct
CREATE BITMAP INDEX idx_bi_fk_risk_factor_currency_code ON FACT_EOD_RISK (RISK_FACTOR_CURRENCY_CODE);  -- 113 distinct
CREATE BITMAP INDEX idx_bi_fk_reporting_tenor1 ON FACT_EOD_RISK (REPORTING_TENOR1);  -- 29 distinct
CREATE BITMAP INDEX idx_bi_fk_reporting_tenor2 ON FACT_EOD_RISK (REPORTING_TENOR2);  -- 919 distinct
CREATE BITMAP INDEX idx_bi_fk_category ON FACT_EOD_RISK (CATEGORY);  -- 3 distinct
CREATE BITMAP INDEX idx_bi_fk_call_put_ind ON FACT_EOD_RISK (CALL_PUT_IND);  -- 2 distinct
CREATE BITMAP INDEX idx_bi_fk_buy_sell_flag ON FACT_EOD_RISK (BUY_SELL_FLAG);  -- 2 distinct
CREATE BITMAP INDEX idx_bi_fk_bpv_ind ON FACT_EOD_RISK (BPV_IND);  -- 2 distinct
CREATE BITMAP INDEX idx_bi_fk_risk_class ON FACT_EOD_RISK (RISK_CLASS);  -- 7 distinct
CREATE BITMAP INDEX idx_bi_fk_pkg_type ON FACT_EOD_RISK (PKG_TYPE);  -- 6 distinct


-- High cardinality FKs
CREATE INDEX idx_bt_fk_trade_id ON FACT_EOD_RISK (TRADE_ID);  -- 177,462 distinct
CREATE INDEX idx_bt_fk_deal_id ON FACT_EOD_RISK (DEAL_ID);  -- 175,261 distinct
CREATE INDEX idx_bt_fk_instrument_id ON FACT_EOD_RISK (INSTRUMENT_ID);  -- 118,106 distinct
CREATE INDEX idx_bt_fk_issuer_id ON FACT_EOD_RISK (ISSUER_ID);  -- 18,555 distinct
CREATE INDEX idx_bt_fk_risk_factor_code ON FACT_EOD_RISK (RISK_FACTOR_CODE);  -- 30,024 distinct
CREATE INDEX idx_bt_fk_rpl_book_id ON FACT_EOD_RISK (RPL_BOOK_ID);  -- 3,587 distinct

