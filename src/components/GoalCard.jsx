/**
 * @fileoverview GoalCard — extracted from GoalView as a file-level component.
 * Prevents re-mounting on every parent re-render.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { IconMap } from './IconMap';
import { differenceInDays, parseISO } from 'date-fns';

function GoalCard({ goal, onClick }) {
    const { Target, CheckSquare } = IconMap;
    const cFrom = goal.colorFrom || 'from-slate-400';
    const cTo = goal.colorTo || 'to-slate-500';
    const hasTasks = goal.tasks && goal.tasks.length > 0;
    const dDay = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;

    return (
        <motion.div
            onClick={() => onClick(goal.id)}
            whileHover={{ y: -4, scale: 1.01 }}
            className={`group cursor-pointer bg-white dark:bg-[#13151a] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-slate-200/60 dark:border-white/5 transition-all flex flex-col relative ${goal.progress === 100 ? 'ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-[#0f1115]' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${goal.title} — ${goal.progress}% 완료`}
            onKeyDown={(e) => e.key === 'Enter' && onClick(goal.id)}
        >
            <div className={`h-20 bg-gradient-to-r ${cFrom} ${cTo} relative`} aria-hidden="true">
                <div className="absolute -bottom-5 left-4 w-11 h-11 bg-white dark:bg-[#1a1c23] rounded-xl flex items-center justify-center text-xl shadow-md border border-slate-100 dark:border-white/10">
                    {goal.icon || '🎯'}
                </div>
                {dDay !== null && (
                    <div className={`absolute top-2.5 right-2.5 text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm ${dDay < 0 ? 'bg-red-500/80 text-white' : dDay <= 3 ? 'bg-orange-500/80 text-white' : 'bg-white/30 text-white'}`}>
                        {dDay < 0 ? `D+${Math.abs(dDay)}` : dDay === 0 ? 'D-Day!' : `D-${dDay}`}
                    </div>
                )}
            </div>

            <div className="p-4 pt-8 flex flex-col flex-1">
                <h3 className={`font-black text-[15px] mb-1 line-clamp-2 ${goal.progress === 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {goal.title} {goal.progress === 100 && '🏆'}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-3">{goal.deadline} 까지</p>

                <div className="mt-auto">
                    <div className="flex justify-between text-[10px] items-end mb-1.5 font-bold uppercase tracking-wide">
                        <span className="text-slate-400 flex items-center gap-1">
                            {goal.tracker?.type === 'numeric' ? (
                                <><Target className="w-3 h-3 text-indigo-400" aria-hidden="true" /> {goal.tracker.current} / {goal.tracker.target} <span className="text-[9px] truncate max-w-[50px]">{goal.tracker.unit.split(' ')[0]}</span></>
                            ) : (
                                <><CheckSquare className="w-3 h-3 text-emerald-400" aria-hidden="true" /> {hasTasks ? `${goal.tasks.filter((t) => t.done).length}/${goal.tasks.length}` : '진행률'}</>
                            )}
                        </span>
                        <span className={goal.progress === 100 ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}>{goal.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={100}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${goal.progress}%` }}
                            className={`h-full bg-gradient-to-r ${goal.progress === 100 ? 'from-emerald-400 to-emerald-500' : `${cFrom} ${cTo}`} rounded-full relative overflow-hidden`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" aria-hidden="true" />
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
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
