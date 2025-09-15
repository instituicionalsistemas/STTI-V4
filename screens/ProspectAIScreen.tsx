import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/Card';
import { TeamMember, ProspectAILead, PipelineStage } from '../types';
import { useData } from '../hooks/useMockData';
import LeadCard from '../components/LeadCard';
import ConfirmationModal from '../components/ConfirmationModal';
import SalespersonProspectPerformanceScreen from './SalespersonProspectPerformanceScreen';
import { ChartBarIcon } from '../components/icons/ChartBarIcon';
import UserProfileDropdown from '../components/UserProfileDropdown';
import NotificationBell from '../components/NotificationBell';
import Modal from '../components/Modal';
import UserProfileForm from '../components/forms/UserProfileForm';
import ChangePasswordForm from '../components/forms/ChangePasswordForm';
import { formatTimeUntil } from '../utils/dateUtils';
import ReassignLeadModal from '../components/modals/ReassignLeadModal';
import { ExclamationIcon } from '../components/icons/ExclamationIcon';
import { UserGroupIcon } from '../components/icons/UserGroupIcon';

interface ProspectAIScreenProps {
    onBack: () => void;
    user: TeamMember;
    onLogout: () => void;
    showBackButton?: boolean;
    isManagerView?: boolean;
    allSalespeople?: TeamMember[];
}

const ProspectCard: React.FC<{ title: string; count: number; color: string; }> = ({ title, count, color }) => {
  return (
    <Card className="p-4 text-center animate-fade-in">
      <p className="text-sm font-medium text-dark-secondary">{title}</p>
      <p className="text-4xl font-bold mt-2" style={{ color }}>{count}</p>
    </Card>
  );
};

const MonthlyLeadsKpi: React.FC<{ companyId: string }> = ({ companyId }) => {
    const { prospectaiLeads } = useData();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const leadsForCompany = useMemo(() => 
        prospectaiLeads.filter(lead => lead.companyId === companyId),
    [prospectaiLeads, companyId]);

    const monthlyLeadsCount = useMemo(() => {
        const [year, month] = selectedDate.split('-').map(Number);
        return leadsForCompany.filter(lead => {
            const leadDate = new Date(lead.createdAt);
            return leadDate.getFullYear() === year && leadDate.getMonth() === month - 1;
        }).length;
    }, [leadsForCompany, selectedDate]);
    
    const monthOptions = useMemo(() => {
        if (leadsForCompany.length === 0) {
            const now = new Date();
            return [{ value: now.toISOString().slice(0, 7), label: now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) }];
        }
        const earliestDate = new Date(Math.min(...leadsForCompany.map(l => new Date(l.createdAt).getTime())));
        const latestDate = new Date();
        const options = [];
        let currentDate = latestDate;

        while (currentDate >= earliestDate) {
            options.push({
                value: currentDate.toISOString().slice(0, 7),
                label: currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
            });
            currentDate.setMonth(currentDate.getMonth() - 1);
        }
        return options;
    }, [leadsForCompany]);

    return (
        <Card className="p-4 text-center animate-fade-in flex flex-col justify-between">
            <div className="flex items-center justify-center gap-2">
                 <UserGroupIcon className="w-4 h-4 text-dark-secondary" />
                 <p className="text-sm font-medium text-dark-secondary">Leads da Empresa (Mês)</p>
            </div>
            <p className="text-4xl font-bold my-2 text-cyan-400">{monthlyLeadsCount}</p>
            <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs bg-dark-background border border-dark-border rounded-md px-2 py-1 text-dark-secondary focus:outline-none focus:ring-1 focus:ring-dark-primary"
            >
                {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </Card>
    );
};

const ProspectColumn: React.FC<{ title: string; count: number; children: React.ReactNode; }> = ({ title, count, children }) => {
  return (
    <div className="bg-dark-card/50 p-4 rounded-lg flex flex-col gap-4 animate-fade-in min-h-[200px]">
      <h3 className="text-lg font-bold text-dark-text">{title} ({count})</h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};


const ProspectAIScreen: React.FC<ProspectAIScreenProps> = ({ onBack, user, onLogout, showBackButton = true, isManagerView = false, allSalespeople = [] }) => {
    const { 
        prospectaiLeads, 
        updateProspectLeadStatus,
        reassignProspectLead,
        companies,
        notifications,
        markNotificationAsRead,
        addNotification,
        teamMembers,
    } = useData();
    const [prospectingLead, setProspectingLead] = useState<ProspectAILead | null>(null);
    const [isPerformanceView, setIsPerformanceView] = useState(false);
    const [isEditProfileModalOpen, setEditProfileModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    const [leadToReassign, setLeadToReassign] = useState<ProspectAILead | null>(null);
    const [pendingLeads, setPendingLeads] = useState<ProspectAILead[]>([]);
    const [isProspectingLocked, setIsProspectingLocked] = useState(false);

    const activeCompany = useMemo(() => companies.find(c => c.id === user.companyId), [companies, user.companyId]);

    // APPOINTMENT NOTIFICATION LOGIC
    useEffect(() => {
        if (!activeCompany) return;

        const NOTIFIED_APPOINTMENTS_KEY = `notified_appointments_${user.id}`;

        const checkAppointments = () => {
            const notifiedIds: string[] = JSON.parse(sessionStorage.getItem(NOTIFIED_APPOINTMENTS_KEY) || '[]');
            const agendadoStage = activeCompany.pipeline_stages.find(s => s.name === 'Agendado');

            if (!agendadoStage) return;

            const upcomingAppointments = prospectaiLeads.filter(lead => {
                if (lead.salespersonId !== user.id || lead.stage_id !== agendadoStage.id || !lead.appointment_at) {
                    return false;
                }
                const appointmentDate = new Date(lead.appointment_at);
                const now = new Date();
                const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                
                return diffHours > 0 && diffHours <= 48;
            });

            const newNotifiedIds = [...notifiedIds];

            upcomingAppointments.forEach(lead => {
                if (!notifiedIds.includes(lead.id)) {
                    const timeUntil = formatTimeUntil(lead.appointment_at!);
                    const lastFeedback = lead.feedback && lead.feedback.length > 0 ? lead.feedback[lead.feedback.length - 1].text : null;

                    let message = `Lembrete: Agendamento com ${lead.leadName} ${timeUntil}.`;
                    if (lastFeedback) {
                        message += ` | Último feedback: "${lastFeedback}"`;
                    }
                    
                    addNotification(message, 'salesperson', user.id);
                    
                    newNotifiedIds.push(lead.id);
                }
            });

            sessionStorage.setItem(NOTIFIED_APPOINTMENTS_KEY, JSON.stringify(newNotifiedIds));
        };

        checkAppointments();
        const intervalId = setInterval(checkAppointments, 60000); 

        return () => clearInterval(intervalId);

    }, [user.id, user.companyId, prospectaiLeads, activeCompany, addNotification]);

    const myLeads = useMemo(() => {
        return prospectaiLeads.filter(lead => 
            lead.salespersonId === user.id || 
            lead.details?.reassigned_from === user.id
        );
    }, [prospectaiLeads, user.id]);

    const userNotifications = useMemo(() => notifications.filter(n => (n.recipientRole === 'salesperson' && !n.userId) || n.userId === user.id), [notifications, user.id]);

    const myCompanyStages = useMemo(() =>
        activeCompany ? [...activeCompany.pipeline_stages]
            .filter(s => s.isEnabled)
            .sort((a, b) => a.stageOrder - b.stageOrder) : [],
        [activeCompany]
    );
    
    // Logic to detect pending leads from previous days
    useEffect(() => {
        if (!myCompanyStages || myCompanyStages.length === 0 || isManagerView) {
            setPendingLeads([]);
            setIsProspectingLocked(false);
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nonActionableStageNames = ['Novos Leads', 'Finalizados', 'Remanejados'];
        const actionableStageIds = myCompanyStages
            .filter(s => s.isEnabled && !nonActionableStageNames.includes(s.name))
            .map(s => s.id);

        const pending = myLeads.filter(lead => {
            if (!actionableStageIds.includes(lead.stage_id)) {
                return false;
            }

            const hasFeedback = lead.feedback && lead.feedback.length > 0;
            if (hasFeedback) {
                const latestFeedbackDate = new Date(lead.feedback[lead.feedback.length - 1].createdAt);
                return latestFeedbackDate < today;
            } else {
                const prospectDate = lead.prospected_at ? new Date(lead.prospected_at) : null;
                if (prospectDate) {
                    return prospectDate < today;
                }
                const creationDate = new Date(lead.createdAt);
                return creationDate < today;
            }
        });
        
        setPendingLeads(pending);
        setIsProspectingLocked(pending.length > 0);
    }, [myLeads, myCompanyStages, isManagerView]);


    const stagesByName = useMemo(() =>
        myCompanyStages.reduce((acc, stage) => {
            acc[stage.name] = stage;
            return acc;
        }, {} as Record<string, PipelineStage>),
        [myCompanyStages]
    );

    const categorizedLeads = useMemo(() => {
        const categories: Record<string, ProspectAILead[]> = {};
        myCompanyStages.forEach(stage => {
            categories[stage.id] = [];
        });

        const novoLeadStageId = stagesByName['Novos Leads']?.id;
        const remanejadoStageId = stagesByName['Remanejados']?.id;

        myLeads.forEach(lead => {
            const leadStage = myCompanyStages.find(s => s.id === lead.stage_id);

            if (lead.details?.reassigned_from === user.id && remanejadoStageId) {
                categories[remanejadoStageId].push(lead);
            } else if (lead.salespersonId === user.id) {
                if (leadStage?.name === 'Remanejados' && novoLeadStageId) {
                    categories[novoLeadStageId].push(lead);
                } else if (categories[lead.stage_id]) {
                    categories[lead.stage_id].push(lead);
                }
            }
        });
        return categories;
    }, [myLeads, user.id, myCompanyStages, stagesByName]);
    
    const hasLeadInProgress = useMemo(() => {
        const emContatoStage = stagesByName['Primeira Tentativa'];
        return emContatoStage && categorizedLeads[emContatoStage.id]?.length > 0;
    }, [categorizedLeads, stagesByName]);


    const handleStartProspecting = async () => {
        if (prospectingLead) {
            const emContatoStage = stagesByName['Primeira Tentativa'];
            if(emContatoStage) {
                await updateProspectLeadStatus(prospectingLead.id, emContatoStage.id);
            }
            setProspectingLead(null);
        }
    };
    
    const handleConfirmReassignment = async (newOwnerId: string) => {
        if (leadToReassign) {
            await reassignProspectLead(leadToReassign.id, newOwnerId, leadToReassign.salespersonId);
            setLeadToReassign(null);
        }
    };

    const counts = useMemo(() => {
        const getCount = (name: string) => {
            const stage = stagesByName[name];
            return stage ? categorizedLeads[stage.id]?.length || 0 : 0;
        };

        const convertedCount = (categorizedLeads[stagesByName['Finalizados']?.id] || []).filter(l => l.outcome === 'convertido').length;
        const notConvertedCount = (categorizedLeads[stagesByName['Finalizados']?.id] || []).filter(l => l.outcome === 'nao_convertido').length;

        return {
            total: myLeads.length,
            converted: convertedCount,
            notConverted: notConvertedCount,
            reallocated: getCount('Remanejados'),
            new: getCount('Novos Leads'),
            contact: getCount('Primeira Tentativa'),
            secondAttempt: getCount('Segunda Tentativa'),
            thirdAttempt: getCount('Terceira Tentativa'),
            scheduled: getCount('Agendado'),
            finished: convertedCount + notConvertedCount,
        };
    }, [myLeads.length, categorizedLeads, stagesByName]);
    

    const placeholderCard = (
        <div className="border-2 border-dashed border-dark-border rounded-lg p-8 text-center text-dark-secondary">
            Nenhum lead nesta etapa.
        </div>
    );
    
    const columnsToRender = myCompanyStages.filter(s => s.name !== 'Remanejados');
    const reallocatedColumn = myCompanyStages.find(s => s.name === 'Remanejados');

    const kpiSettings = activeCompany?.prospectAISettings?.show_monthly_leads_kpi;
    const showMonthlyKpi = kpiSettings?.enabled && (kpiSettings.visible_to === 'all' || kpiSettings.visible_to.includes(user.id));

    if (!activeCompany) {
        return <div>Carregando...</div>;
    }

    if (isPerformanceView) {
        return (
            <SalespersonProspectPerformanceScreen
                user={user}
                leads={myLeads}
                onBack={() => setIsPerformanceView(false)}
            />
        );
    }

    return (
        <div className="animate-fade-in">
            <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div>
                    {showBackButton && (
                        <button onClick={onBack} className="flex items-center gap-2 text-sm text-dark-secondary hover:text-dark-text mb-2">
                            &larr; Voltar
                        </button>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-bold text-dark-text">Pipeline de Prospecção</h1>
                </div>
                 <div className="flex items-center gap-4">
                     <button
                        onClick={() => setIsPerformanceView(true)}
                        className="flex items-center gap-2 bg-dark-card border border-dark-border px-4 py-2 rounded-lg hover:border-dark-primary transition-colors font-medium text-sm"
                    >
                        <ChartBarIcon className="w-4 h-4" />
                        Analisar Desempenho
                    </button>
                    <NotificationBell
                        notifications={userNotifications}
                        onMarkAsRead={markNotificationAsRead}
                    />
                    <UserProfileDropdown
                        company={{ ...activeCompany, name: user.name, logoUrl: user.avatarUrl, email: user.email }}
                        onEditProfile={() => setEditProfileModalOpen(true)}
                        onChangePassword={() => setChangePasswordModalOpen(true)}
                        onLogout={onLogout}
                        onManageTeam={() => {}}
                    />
                </div>
            </header>
            
            {isProspectingLocked && (
                <div className="bg-yellow-900/40 border border-yellow-500/50 rounded-lg p-4 mb-8 flex items-start gap-4 animate-fade-in">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center mt-1">
                        <ExclamationIcon className="w-5 h-5 text-yellow-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white">Ação Necessária</h3>
                        <p className="text-sm text-yellow-200 mt-1">
                            Você possui <strong>{pendingLeads.length} lead(s) pendente(s)</strong> de dias anteriores. É necessário registrar um feedback para cada um deles antes de poder prospectar novos leads.
                        </p>
                    </div>
                </div>
            )}

            {/* Top Row Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 mb-8">
                {showMonthlyKpi && <MonthlyLeadsKpi companyId={user.companyId} />}
                <ProspectCard title="Meus Leads Atribuídos" count={counts.total} color="#00D1FF" />
                <ProspectCard title="Leads Convertidos" count={counts.converted} color="#22C55E" />
                <ProspectCard title="Primeira Tentativa" count={counts.contact} color="#FBBF24" />
                <ProspectCard title="Segunda Tentativa" count={counts.secondAttempt} color="#F59E0B" />
                <ProspectCard title="Terceira Tentativa" count={counts.thirdAttempt} color="#8B5CF6" />
                <ProspectCard title="Leads Agendados" count={counts.scheduled} color="#60A5FA" />
                <ProspectCard title="Leads Não Convertidos" count={counts.notConverted} color="#EF4444" />
                {/* Remanejados is shown but we might need to adjust grid if monthly is shown */}
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-6">
                 {columnsToRender.map(stage => {
                    const isNovosLeadsColumn = stage.name === 'Novos Leads';
                    return (
                        <ProspectColumn key={stage.id} title={stage.name} count={categorizedLeads[stage.id]?.length || 0}>
                            {(categorizedLeads[stage.id] || []).length > 0
                                ? categorizedLeads[stage.id].map((lead, index) => (
                                    <LeadCard 
                                        key={lead.id} 
                                        lead={lead} 
                                        onClick={() => setProspectingLead(lead)} 
                                        isDisabled={isNovosLeadsColumn && (hasLeadInProgress || isProspectingLocked || index > 0)} 
                                        isManagerView={isManagerView} 
                                        onReassign={setLeadToReassign} 
                                        allSalespeople={teamMembers}
                                    />
                                ))
                                : placeholderCard
                            }
                        </ProspectColumn>
                    );
                })}
                 {reallocatedColumn && (
                    <ProspectColumn title={reallocatedColumn.name} count={categorizedLeads[reallocatedColumn.id]?.length || 0}>
                        {(categorizedLeads[reallocatedColumn.id] || []).length > 0
                            ? categorizedLeads[reallocatedColumn.id].map(lead => (
                                <LeadCard 
                                    key={lead.id} 
                                    lead={lead} 
                                    isReassignedAwayView={true} 
                                    isManagerView={isManagerView} 
                                    allSalespeople={teamMembers}
                                />
                            ))
                            : placeholderCard
                        }
                    </ProspectColumn>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!prospectingLead}
                onClose={() => setProspectingLead(null)}
                onConfirm={handleStartProspecting}
                title="Iniciar Prospecção"
                confirmButtonText="Iniciar Prospecção"
                confirmButtonClass="bg-green-600 hover:bg-green-700"
            >
                Deseja mover o lead <strong className="text-dark-text">{prospectingLead?.leadName}</strong> para a etapa "Em Contato"?
            </ConfirmationModal>

             {leadToReassign && (
                <ReassignLeadModal
                    isOpen={!!leadToReassign}
                    onClose={() => setLeadToReassign(null)}
                    lead={leadToReassign}
                    salespeople={allSalespeople.filter(sp => sp.id !== leadToReassign.salespersonId)}
                    onConfirm={handleConfirmReassignment}
                />
            )}

            <Modal isOpen={isEditProfileModalOpen} onClose={() => setEditProfileModalOpen(false)}>
                <UserProfileForm initialData={user} onClose={() => setEditProfileModalOpen(false)} />
            </Modal>
            
            <Modal isOpen={isChangePasswordModalOpen} onClose={() => setChangePasswordModalOpen(false)}>
                <ChangePasswordForm onClose={() => setChangePasswordModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default ProspectAIScreen;