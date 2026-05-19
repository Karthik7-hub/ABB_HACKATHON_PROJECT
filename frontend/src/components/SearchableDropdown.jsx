import React, { useState, useEffect, useRef } from 'react';

export default function SearchableDropdown({ options, value, onChange, placeholder, style, inputStyle, listStyle }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef(null);

  // Sync internal search state with selected value
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    setSearch(selectedOption ? selectedOption.label : '');
    setIsTyping(false);
  }, [value, selectedOption?.label]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsTyping(false);
        setSearch(selectedOption ? selectedOption.label : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, selectedOption?.label]);

  // Filter logic: show all options if the user is not actively typing/filtering
  const filtered = !isTyping
    ? options
    : options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase()) || 
        opt.value.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsTyping(true);
            setIsOpen(true);
            
            // If user types exactly a valid option value or label, trigger onChange
            const matched = options.find(opt => 
              opt.label.toLowerCase() === e.target.value.toLowerCase() ||
              opt.value.toLowerCase() === e.target.value.toLowerCase()
            );
            if (matched && matched.value !== value) {
              onChange(matched.value);
            }
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select(); // Highlight existing text on focus
          }}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '8px 30px 8px 12px',
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '11px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
            ...inputStyle
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setIsTyping(false);
              setSearch(selectedOption ? selectedOption.label : '');
            }
          }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
            setIsTyping(false); // Reset typing status when using the dropdown button to show all options
          }}
          style={{
            position: 'absolute',
            right: '8px',
            background: 'none',
            border: 'none',
            color: '#38bdf8',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            outline: 'none',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '8px',
          maxHeight: '160px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
          scrollbarWidth: 'thin',
          ...listStyle
        }}>
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  if (opt.value !== value) {
                    onChange(opt.value);
                  }
                  setSearch(opt.label);
                  setIsTyping(false);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: opt.value === value ? '#38bdf8' : '#e2e8f0',
                  background: opt.value === value ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  transition: 'all 0.2s',
                  fontWeight: opt.value === value ? 'bold' : 'normal',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(56, 189, 248, 0.15)';
                  e.target.style.color = '#38bdf8';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = opt.value === value ? 'rgba(56, 189, 248, 0.1)' : 'transparent';
                  e.target.style.color = opt.value === value ? '#38bdf8' : '#e2e8f0';
                }}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
              No matching assets
            </div>
          )}
        </div>
      )}
    </div>
  );
}
