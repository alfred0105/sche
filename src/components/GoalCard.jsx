/**
 * @fileoverview GoalCard — extracted from GoalView as a file-level component.
 * Prevents re-mounting on every parent re-render.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { IconMap } from './IconMap';
import { differenceInDays, parseISO } from 'date-fns';

function GoalCard({ goal, onClick }) {
    const { Target, CheckSquare } = IconMap;
    const cFrom = goal.colorFrom || 'from-slate-400';
    const cTo = goal.colorTo || 'to-slate-500';
    const hasTasks = goal.tasks && goal.tasks.length > 0;
    const dDay = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;

    return (
        <div
            onClick={() => onClick(goal.id)}
            className={`group cursor-pointer bg-[#111113] overflow-hidden border border-white/8 transition-all flex flex-col relative hover:bg-white/[0.02] ${goal.progress === 100 ? 'border-emerald-500/40' : ''}`}
            style={{ borderRadius: '3px' }}
            role="button"
            tabIndex={0}
            aria-label={`${goal.title} — ${goal.progress}% 완료`}
            onKeyDown={(e) => e.key === 'Enter' && onClick(goal.id)}
        >
            <div className={`h-20 bg-gradient-to-r ${cFrom} ${cTo} relative`} aria-hidden="true">
                <div className="absolute -bottom-5 left-4 w-11 h-11 bg-[#111113] flex items-center justify-center text-xl border border-white/10" style={{ borderRadius: '3px' }}>
                    {goal.icon || '🎯'}
                </div>
                {dDay !== null && (
                    <div className={`absolute top-2.5 right-2.5 text-[10px] font-bold tracking-tight px-2 py-0.5 font-mono tabular-nums ${dDay < 0 ? 'bg-red-500/80 text-white' : dDay <= 3 ? 'bg-orange-500/80 text-white' : 'bg-white/30 text-white'}`}>
                        {dDay < 0 ? `D+${Math.abs(dDay)}` : dDay === 0 ? 'D-Day!' : `D-${dDay}`}
                    </div>
                )}
            </div>

            <div className="p-4 pt-8 flex flex-col flex-1">
                <h3 className={`font-bold tracking-tight text-[15px] mb-1 line-clamp-2 ${goal.progress === 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {goal.title} {goal.progress === 100 && '🏆'}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 mb-3">{goal.deadline} 까지</p>

                <div className="mt-auto">
                    <div className="flex justify-between text-[10px] items-end mb-1.5 font-bold uppercase tracking-wide">
                        <span className="text-slate-400 flex items-center gap-1">
                            {goal.tracker?.type === 'numeric' ? (
                                <><Target className="w-3 h-3 text-indigo-400" aria-hidden="true" /> {goal.tracker.current} / {goal.tracker.target} <span className="text-[9px] truncate max-w-[50px]">{goal.tracker.unit.split(' ')[0]}</span></>
                            ) : (
                                <><CheckSquare className="w-3 h-3 text-emerald-400" aria-hidden="true" /> {hasTasks ? `${goal.tasks.filter((t) => t.done).length}/${goal.tasks.length}` : '진행률'}</>
                            )}
                        </span>
                        <span className={goal.progress === 100 ? 'text-emerald-500' : 'text-slate-200'}>{goal.progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/8" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={100}>
                        <div
                            style={{ width: `${goal.progress}%` }}
                            className={`h-1 ${goal.progress === 100 ? 'bg-emerald-400' : 'bg-indigo-500'} transition-all`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

GoalCard.propTypes = {
    goal: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        title: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        deadline: PropTypes.string,
        icon: PropTypes.string,
        colorFrom: PropTypes.string,
        colorTo: PropTypes.string,
        tasks: PropTypes.array,
        tracker: PropTypes.object,
    }).isRequired,
    onClick: PropTypes.func.isRequired,
};

export default React.memo(GoalCard);
