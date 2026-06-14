import React from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
}) => {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-content">
        <h3 className="empty-state-title">{title}</h3>
        {description && <p className="empty-state-description">{description}</p>}
        {action && <div className="empty-state-action">{action}</div>}
      </div>
    </div>
  );
};

export default EmptyState;
