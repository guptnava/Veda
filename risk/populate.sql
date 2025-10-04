-- BEGIN
--     PKG_EOD_RISK_LOAD.LOAD_DIMENSIONS(TO_DATE('2025-10-03', 'YYYY-MM-DD'));
--     PKG_EOD_RISK_LOAD.LOAD_FACT_EOD_RISK(TO_DATE('2025-10-03', 'YYYY-MM-DD'));
-- END;


DECLARE
    v_cob DATE := DATE '2024-03-31';
BEGIN
    pkg_csa_val_sens_star.load_day(v_cob);
    DBMS_OUTPUT.PUT_LINE('Loaded COB ' || TO_CHAR(v_cob, 'YYYY-MM-DD'));
END;
/

-- BEGIN
--     pkg_csa_val_sens_star.load_range(
--         p_start_date => DATE '2024-03-01',
--         p_end_date   => DATE '2024-03-31'
--     );
--     DBMS_OUTPUT.PUT_LINE('Range load complete.');
-- END;
-- /
