
import React from 'react';

type Props = React.SVGProps<SVGSVGElement> & { name:
  'dashboard'|'gauge'|'cog'|'info'|'search'|'plus'|'chev-right'|'more'|'dot'|'moon'|'sun'
};

export default function Icon({name, ...props}: Props){
  switch(name){
    case 'dashboard': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 7v-8h8v8h-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    );
    case 'gauge': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><path d="M5 20a9 9 0 1114 0" stroke="currentColor" strokeWidth="1.5"/><path d="M12 13l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    );
    case 'cog': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><path d="M12 8a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="1.5"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    );
    case 'info': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8.5v.5M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    );
    case 'search': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    );
    case 'plus': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    );
    case 'chev-right': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    );
    case 'more': return (
      <svg viewBox="0 0 24 24" fill="currentColor" {...props}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
    );
    case 'dot': return (
      <svg viewBox="0 0 8 8" fill="currentColor" {...props}><circle cx="4" cy="4" r="4"/></svg>
    );
    case 'moon': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.5"/></svg>
    );
    case 'sun': return (
      <svg viewBox="0 0 24 24" fill="none" {...props}><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2m0-14l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    );
    default: return null;
  }
}
