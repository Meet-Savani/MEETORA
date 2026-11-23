import React, { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import '../../styles/DataTable.scss';

const DataTable = ({
    columns = [],
    data = [],
    searchKeys = [],
    pageSize = 10,
    emptyMessage = 'No records found.',
    onRowClick,
}) => {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        let rows = [...data];
        if (search.trim() && searchKeys.length) {
            const q = search.toLowerCase();
            rows = rows.filter((row) =>
                searchKeys.some((key) => {
                    const val = key.split('.').reduce((o, k) => o?.[k], row);
                    return String(val || '').toLowerCase().includes(q);
                })
            );
        }
        if (sortKey) {
            rows.sort((a, b) => {
                const av = sortKey.split('.').reduce((o, k) => o?.[k], a);
                const bv = sortKey.split('.').reduce((o, k) => o?.[k], b);
                if (av < bv) return sortDir === 'asc' ? -1 : 1;
                if (av > bv) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rows;
    }, [data, search, searchKeys, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    return (
        <div className="data-table-wrapper">
            {searchKeys.length > 0 && (
                <div className="data-table-toolbar">
                    <div className="data-table-search">
                        <Search />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <span className="data-table-count">{filtered.length} results</span>
                </div>
            )}

            <div className="data-table-scroll">
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={col.sortable ? 'sortable' : ''}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <span>{col.label}</span>
                                    {col.sortable && sortKey === col.key && (
                                        sortDir === 'asc' ? <ArrowUpward className="sort-icon" /> : <ArrowDownward className="sort-icon" />
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length > 0 ? paginated.map((row, idx) => (
                            <tr
                                key={row._id || idx}
                                onClick={() => onRowClick?.(row)}
                                className={onRowClick ? 'clickable' : ''}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} data-label={col.label}>
                                        <span className="mobile-col-label">{col.label}</span>
                                        <span className="col-value">
                                            {col.render ? col.render(row) : (col.key.split('.').reduce((o, k) => o?.[k], row) ?? '-')}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={columns.length} className="empty-cell">{emptyMessage}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="data-table-pagination">
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        <ChevronLeft /> Prev
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        Next <ChevronRight />
                    </button>
                </div>
            )}
        </div>
    );
};

export default DataTable;
