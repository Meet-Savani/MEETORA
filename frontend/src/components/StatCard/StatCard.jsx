import React from 'react';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import '../../styles/StatCard.scss';

const StatCard = ({ title, value, growth, period = 'vs last week', prefix = '', suffix = '' }) => {
    const isPositive = growth >= 0;
    const hasGrowth = growth !== undefined && growth !== null;

    return (
        <div className="stat-card-pro">
            <div className="stat-card-header">
                <h3>{title}</h3>
                {hasGrowth && (
                    <span className={`stat-growth ${isPositive ? 'up' : 'down'}`}>
                        {isPositive ? <TrendingUp /> : <TrendingDown />}
                        {Math.abs(growth)}%
                    </span>
                )}
            </div>
            <div className="stat-card-value">
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </div>
            {hasGrowth && <p className="stat-card-period">{period}</p>}
        </div>
    );
};

export default StatCard;
