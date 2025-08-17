import { useEffect, useRef, useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
}

interface TemplateDropdownProps {
  templates: Template[];
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

const TemplateDropdown = ({ templates, value, onChange, error }: TemplateDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = templates.find((t) => t.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`input w-full flex justify-between items-center ${open ? 'ring-2 ring-primary' : ''} ${error ? 'border-danger focus:ring-danger' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected ? selected.name : 'Select a template'}</span>
        <span className="ml-2">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-midgray rounded-md shadow-lg max-h-60 overflow-auto">
          {templates.map((t) => (
            <div
              key={t.id}
              className="p-2 hover:bg-neutral cursor-pointer"
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-darkgray/70 whitespace-normal break-words">
                {t.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateDropdown;
