import React, { useState, useEffect } from 'react';
import cronstrue from 'cronstrue';
import { CronExpressionParser } from 'cron-parser';

interface ScheduleInputProps {
  value: string; // The NL string or raw cron
  onChange: (nl: string, cron: string) => void;
  className?: string;
}

export const ScheduleInput: React.FC<ScheduleInputProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value !== inputValue) setInputValue(value);
  }, [value]);

  const parseNLToCron = (nl: string): string | null => {
    const s = nl.toLowerCase().trim();

    // Raw cron passthrough (5 fields)
    if (/^(\d+|\*) (\d+|\*) (\d+|\*) (\d+|\*) (\d+|\*)$/.test(s)) {
      return s;
    }

    // Every day at Xam/pm
    const dailyMatch = s.match(/every day at (\d+)(am|pm)/);
    if (dailyMatch && dailyMatch[1] && dailyMatch[2]) {
      let hour = parseInt(dailyMatch[1], 10);
      const ampm = dailyMatch[2];
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      return `0 ${hour} * * *`;
    }

    // Every weekday at Xam/pm
    const weekdayMatch = s.match(/every weekday at (\d+)(am|pm)/);
    if (weekdayMatch && weekdayMatch[1] && weekdayMatch[2]) {
      let hour = parseInt(weekdayMatch[1], 10);
      const ampm = weekdayMatch[2];
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      return `0 ${hour} * * 1-5`;
    }

    // Every [day] at Xam/pm
    const dayMap: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0
    };
    for (const day in dayMap) {
      const dayRegex = new RegExp(`every ${day} at (\\d+)(am|pm)`);
      const match = s.match(dayRegex);
      if (match && match[1] && match[2]) {
        let hour = parseInt(match[1], 10);
        const ampm = match[2];
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        return `0 ${hour} * * ${dayMap[day]}`;
      }
    }

    // Simple patterns
    if (s === 'twice a day') return '0 0,12 * * *';
    if (s === 'every hour') return '0 * * * *';
    if (s === 'every minute') return '* * * * *';

    return null;
  };

  useEffect(() => {
    const cron = parseNLToCron(inputValue);
    if (cron) {
      try {
        CronExpressionParser.parse(cron); // Validate with cron-parser
        const desc = cronstrue.toString(cron);
        setPreview(`→ ${cron} (${desc})`);
        setError(null);
        onChange(inputValue, cron);
      } catch (e) {
        setPreview('');
        setError('Invalid cron generated internally');
      }
    } else if (inputValue === '') {
      setPreview('');
      setError(null);
      onChange('', '');
    } else {
      setPreview('');
      setError("Could not parse — try 'every day at 8pm'");
    }
  }, [inputValue]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
        Schedule (Natural Language)
      </label>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="e.g. every weekday at 9am"
        className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded outline-none focus:border-copernicus-phosphor/50 text-zinc-200"
      />
      {preview && <div className="text-[10px] text-copernicus-phosphor font-mono">{preview}</div>}
      {error && <div className="text-[10px] text-red-400 font-mono">{error}</div>}
    </div>
  );
};
