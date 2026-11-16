package com.promora.common;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Thin read-side helper: named-parameter SQL returning camelCase maps and pages. All SQL is parameterised. */
@Component
public class Sql {
    private final NamedParameterJdbcTemplate jdbc;

    public Sql(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public static int clampSize(Integer size) { return size == null ? 20 : Math.max(1, Math.min(size, 100)); }
    public static int clampPage(Integer page) { return page == null ? 0 : Math.max(0, page); }

    public List<Map<String, Object>> list(String sql, Map<String, ?> params) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList(sql, new MapSqlParameterSource(params))) out.add(camel(row));
        return out;
    }

    public Map<String, Object> one(String sql, Map<String, ?> params) {
        List<Map<String, Object>> rows = list(sql, params);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public long count(String sql, Map<String, ?> params) {
        Long n = jdbc.queryForObject(sql, new MapSqlParameterSource(params), Long.class);
        return n == null ? 0 : n;
    }

    public int update(String sql, Map<String, ?> params) { return jdbc.update(sql, new MapSqlParameterSource(params)); }

    /** selectFrom is "SELECT ... FROM ... WHERE ..." without ORDER BY; fromWhere is the same query from FROM onwards. */
    public PageResponse<Map<String, Object>> page(String select, String fromWhere, String orderBy, Map<String, Object> params, Integer page, Integer size) {
        int p = clampPage(page), s = clampSize(size);
        Map<String, Object> all = new LinkedHashMap<>(params);
        all.put("_limit", s);
        all.put("_offset", p * s);
        List<Map<String, Object>> items = list(select + " " + fromWhere + " ORDER BY " + orderBy + " LIMIT :_limit OFFSET :_offset", all);
        long total = count("SELECT count(*) " + fromWhere, params);
        return PageResponse.of(items, p, s, total);
    }

    private static Map<String, Object> camel(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((k, v) -> out.put(toCamel(k), convert(v)));
        return out;
    }
    private static Object convert(Object v) {
        if (v instanceof Timestamp t) return t.toInstant().toString();
        if (v instanceof OffsetDateTime o) return o.toInstant().toString();
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        if (v instanceof java.util.UUID u) return u.toString();
        return v;
    }
    private static String toCamel(String s) {
        StringBuilder b = new StringBuilder();
        boolean up = false;
        for (char c : s.toCharArray()) {
            if (c == '_') { up = true; continue; }
            b.append(up ? Character.toUpperCase(c) : c);
            up = false;
        }
        return b.toString();
    }
}
