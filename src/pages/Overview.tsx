
import React from 'react';
import Icon from '../components/Icon';
export default function Overview(){
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Overview</h2>
          <span className="pill">Last month</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="text-sm text-gray-500 mb-2">Customers</div>
            <div className="text-4xl font-semibold">1,293</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-red-500">▼ 36.8%</span>
              <span className="text-gray-500">vs last month</span>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-gray-500 mb-2">Balance</div>
            <div className="text-4xl font-semibold">256k</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-green-600">▲ 36.8%</span>
              <span className="text-gray-500">vs last month</span>
            </div>
          </div>
        </div>

        <div className="mt-6 card p-4">
          <div className="mb-2 text-sm text-gray-500">857 new customers today!</div>
          <div className="flex items-center gap-4">
            {['Gladyce','Elbert','Dash','Joyce','Marina'].map(n => (
              <div key={n} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-gray-300"/>
                <div className="text-xs text-gray-600">{n}</div>
              </div>
            ))}
            <button className="ml-auto icon-btn"><Icon name="chev-right" className="w-4 h-4"/></button>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Product view</h3>
          <span className="pill">Last 7 days</span>
        </div>
        {/* Simple chart bars */}
        <div className="h-48 w-full grid grid-cols-12 gap-2 items-end">
          {Array.from({length:12}).map((_,i)=>{
            const h = [20,28,18,35,22,26,40,52,24,30,26,22][i];
            const isPeak = i===7;
            return (
              <div key={i} className="relative">
                <div className={`rounded-xl bg-gradient-to-t from-green-200 to-green-400`} style={{height: `${h*2}px`}}/>
                {isPeak && <div className="absolute -top-6 inset-x-0 text-center text-xs font-semibold">2.2m</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-6 text-5xl font-bold text-gray-300">$10.2m</div>
      </section>
    </div>
  );
}
