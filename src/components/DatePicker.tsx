import React, { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import './DatePicker.css';

interface DatePickerProps {
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  format?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = '请选择日期',
  format = 'YYYY-MM-DD',
  disabled = false,
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? dayjs(value) : dayjs());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayValue = value ? dayjs(value).format(format) : '';

  const handleSelectDate = (date: dayjs.Dayjs) => {
    const formattedDate = date.format(format);
    onChange?.(formattedDate);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setViewDate(viewDate.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setViewDate(viewDate.add(1, 'month'));
  };

  const handleToday = () => {
    setViewDate(dayjs());
    handleSelectDate(dayjs());
  };

  const isDateDisabled = (date: dayjs.Dayjs) => {
    if (minDate && date.isBefore(dayjs(minDate).startOf('day'))) return true;
    if (maxDate && date.isAfter(dayjs(maxDate).endOf('day'))) return true;
    return false;
  };

  const renderCalendar = () => {
    const year = viewDate.year();
    const month = viewDate.month();
    const firstDay = dayjs(`${year}-${month + 1}-01`);
    const startDay = firstDay.startOf('week');
    const days: dayjs.Dayjs[] = [];

    for (let i = 0; i < 42; i++) {
      days.push(startDay.add(i, 'day'));
    }

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
      <div className="calendar">
        <div className="calendar-header">
          <button className="calendar-nav-btn" onClick={handlePrevMonth}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="calendar-title">
            <span className="calendar-year-month">{year}年{month + 1}月</span>
          </div>
          <button className="calendar-nav-btn" onClick={handleNextMonth}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map((day, index) => (
            <div key={index} className="calendar-weekday">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-days">
          {days.map((date, index) => {
            const isCurrentMonth = date.month() === month;
            const isSelected = value && date.isSame(dayjs(value), 'day');
            const isToday = date.isSame(dayjs(), 'day');
            const isDisabled = isDateDisabled(date);

            return (
              <button
                key={index}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleSelectDate(date)}
                disabled={isDisabled}
              >
                {date.date()}
              </button>
            );
          })}
        </div>

        <div className="calendar-footer">
          <button className="calendar-today-btn" onClick={handleToday}>
            今天
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="date-picker" ref={containerRef}>
      <div
        className={`date-picker-input ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`date-picker-value ${!displayValue ? 'placeholder' : ''}`}>
          {displayValue || placeholder}
        </span>
        <svg className="date-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      {isOpen && !disabled && renderCalendar()}
    </div>
  );
};

export default DatePicker;
