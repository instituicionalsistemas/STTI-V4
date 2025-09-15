import React, { useState, ChangeEvent, FormEvent, useMemo, useEffect } from 'react';
import { ProspectAILead, TeamMember, PipelineStage } from '../types';
import Card from './Card';
import { useData } from '../hooks/useMockData';
import { UserCircleIcon } from './icons/UserCircleIcon';
import { CarIcon } from './icons/CarIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { SwitchHorizontalIcon } from './icons/SwitchHorizontalIcon';
import { BullseyeIcon } from './icons/BullseyeIcon';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { UploadIcon } from './icons/UploadIcon';
import { XIcon } from './icons/XIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import Modal from './Modal';
import ImageLightbox from './ImageLightbox';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { ChatBubbleOvalLeftEllipsisIcon } from './icons/ChatBubbleOvalLeftEllipsisIcon';
import { ClockIcon } from './icons/ClockIcon';

interface LeadCardProps {
    lead: ProspectAILead;
    onClick?: () => void;
    isDisabled?: boolean;
    isManagerView?: boolean;
    allSalespeople?: TeamMember[];
    onReassign?: (lead: ProspectAILead) => void;
    isReassignedAwayView?: boolean;
}

const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string | undefined | null; }> = ({ icon, label, value }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3 text-sm">
            <div className="flex-shrink-0 text-dark-secondary mt-0.5">{icon}</div>
            <div>
                <p className="text-xs text-dark-secondary">{label}</p>
                <p className="font-medium text-dark-text whitespace-pre-wrap">{value}</p>
            </div>
        </div>
    );
};

// Mapeamento de chaves para ícones e rótulos amigáveis
const detailConfig: { [key: string]: { label: string; icon: React.FC<{ className?: string }> } } = {
    carro_na_troca: { label: 'Carro na Troca', icon: SwitchHorizontalIcon },
    forma_de_pagamento: { label: 'Forma de Pagamento', icon: DollarSignIcon },
    comprar_como: { label: 'Comprar como', icon: UserCircleIcon },
    tipo_de_compra: { label: 'Tipo de Compra', icon: UserCircleIcon },
    uso_pretendido: { label: 'Uso Pretendido', icon: BullseyeIcon },
    observacao: { label: 'Observação', icon: DocumentTextIcon },
};

// Função para formatar chaves desconhecidas (ex: "algum_campo" -> "Algum Campo")
const formatKeyToLabel = (key: string): string => {
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick, isDisabled = false, isManagerView = false, allSalespeople = [], onReassign, isReassignedAwayView = false }) => {
    const { companies, teamMembers, addProspectLeadFeedback, updateProspectLeadStatus } = useData();
    const [isCopied, setIsCopied] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackImages, setFeedbackImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showStatusButtons, setShowStatusButtons] = useState(false);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);


    const leadCompany = companies.find(c => c.id === lead.companyId);
    const pipelineStages = leadCompany?.pipeline_stages || [];
    const leadStage = pipelineStages.find(s => s.id === lead.stage_id);
    const leadSalesperson = teamMembers.find(tm => tm.id === lead.salespersonId);
    
    useEffect(() => {
        if (!leadSalesperson || leadStage?.name !== 'Novos Leads') {
            setTimeLeft(null);
            return;
        }

        const deadlineSettings = leadSalesperson.prospectAISettings?.deadlines?.initial_contact;
        if (!deadlineSettings?.auto_reassign_enabled) {
            setTimeLeft(null);
            return;
        }

        const deadlineMinutes = deadlineSettings.minutes;
        const createdAt = new Date(lead.createdAt).getTime();
        const deadline = createdAt + deadlineMinutes * 60 * 1000;

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const remaining = deadline - now;
            setTimeLeft(remaining > 0 ? remaining : 0);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [lead.id, lead.createdAt, leadStage?.name, leadSalesperson]);

    const formatTime = (ms: number | null): string => {
        if (ms === null || ms <= 0) return '00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const getTimerColor = (ms: number | null, totalMinutes: number): string => {
        if (ms === null || ms <= 0) return 'text-red-400';
        const totalMs = totalMinutes * 60 * 1000;
        const percentage = (ms / totalMs) * 100;

        if (percentage <= 25) return 'text-red-400';
        if (percentage <= 50) return 'text-yellow-400';
        return 'text-green-400';
    };
    
    const deadlineMinutes = leadSalesperson?.prospectAISettings?.deadlines?.initial_contact?.minutes;
    const showTimer = timeLeft !== null && deadlineMinutes;


    const appointmentTimestamp = lead.appointment_at || lead.details?.appointment_date;
    const formattedDateTime = leadStage?.name === 'Agendado' && appointmentTimestamp
        ? new Date(appointmentTimestamp).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        : new Date(lead.createdAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

    const handleCopyPhone = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (lead.leadPhone) {
            navigator.clipboard.writeText(lead.leadPhone);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFeedbackImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setFeedbackImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmitFeedback = async (e: FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!feedbackText.trim() || isSubmitting) return;

        setIsSubmitting(true);
        await addProspectLeadFeedback(lead.id, feedbackText, feedbackImages);
        setFeedbackText('');
        setFeedbackImages([]);
        setIsFeedbackOpen(false);
        setShowStatusButtons(true);
        setIsSubmitting(false);
    };

    const handleStatusUpdate = async (e: React.MouseEvent, stageName: string, details?: Record<string, any>) => {
        e.stopPropagation();
        const targetStage = pipelineStages.find(s => s.name === stageName);
        if (targetStage) {
            await updateProspectLeadStatus(lead.id, targetStage.id, details);
        } else {
            console.error(`Stage "${stageName}" not found for company.`);
        }
    };


    const handleConfirmAppointment = async (e: FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (appointmentDate && appointmentTime) {
            const appointmentDateTime = `${appointmentDate}T${appointmentTime}`;
            const agendadoStage = pipelineStages.find(s => s.name === 'Agendado');
            if (agendadoStage) {
                 await updateProspectLeadStatus(lead.id, agendadoStage.id, { appointment_date: appointmentDateTime });
            }
            setIsAppointmentModalOpen(false);
        }
    };

    const actionableStages = useMemo(() => {
        if (!leadStage) return [];
        return pipelineStages
            .filter(s => 
                s.isEnabled &&
                s.stageOrder > leadStage.stageOrder &&
                s.name !== 'Remanejados'
            )
            .sort((a, b) => a.stageOrder - b.stageOrder);
    }, [pipelineStages, leadStage]);

    let statusBorderClass = '';
    const isReassigned = !!lead.details?.reassigned_from;

    if (leadStage?.name === 'Finalizados') {
        if (lead.outcome === 'convertido') {
             statusBorderClass = 'border-2 border-green-500/60';
        } else if (lead.outcome === 'nao_convertido') {
            statusBorderClass = 'border-2 border-red-500/60';
        }
    } else if (isReassignedAwayView) {
        statusBorderClass = 'border-2 border-purple-500/60 opacity-70';
    } else if (isReassigned) {
        statusBorderClass = 'border-2 border-purple-500/80';
    } else if (leadStage?.name === 'Novos Leads') {
        statusBorderClass = 'border-2 border-dark-border';
    }

    const isFinalized = leadStage?.name === 'Finalizados';
    const isClickableForManager = isManagerView;
    const isClickableForUser = !isManagerView && (leadStage?.name === 'Agendado' || isFinalized);
    const isClickableForProspecting = !isDisabled && leadStage?.name === 'Novos Leads' && onClick;

    const handleCardClick = () => {
        if (isClickableForManager || isClickableForUser) {
            setIsDetailModalOpen(true);
        } else if (isClickableForProspecting) {
            onClick?.();
        }
    };
    
    const handleReassignClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onReassign) {
            onReassign(lead);
        }
        setIsDetailModalOpen(false); // Close current modal to open the next one
    };


    const cardClassName = `p-4 transition-all duration-300 animate-fade-in ${
        (isClickableForManager || isClickableForUser || isClickableForProspecting) ? 'cursor-pointer hover:border-dark-primary/50' : ''
    } ${
        isDisabled && leadStage?.name === 'Novos Leads' ? 'opacity-60 cursor-not-allowed' : ''
    } ${statusBorderClass}`;

     if (isReassignedAwayView) {
        const reassignedToName = allSalespeople.find(sp => sp.id === lead.salespersonId)?.name || 'outro vendedor';
        return (
             <Card className={cardClassName}>
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-dark-background border border-dark-border flex items-center justify-center">
                        <UserCircleIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-dark-text line-through">{lead.leadName}</h4>
                        <p className="text-xs text-dark-secondary">{new Date(lead.details?.reassigned_at || lead.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-dark-border text-center">
                    <p className="text-sm font-semibold text-purple-400 flex items-center justify-center gap-2">
                        <ArrowRightIcon /> Remanejado para {reassignedToName}
                    </p>
                </div>
             </Card>
        )
    }

    return (
        <>
            <Card className={cardClassName} onClick={handleCardClick}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-dark-background border border-dark-border flex items-center justify-center">
                            <UserCircleIcon className="w-6 h-6 text-dark-primary" />
                        </div>
                        <div>
                            <h4 className="font-bold text-dark-text">{lead.leadName}</h4>
                            <p className="text-xs text-dark-secondary">{formattedDateTime}</p>
                        </div>
                    </div>
                </div>
                
                {showTimer && deadlineMinutes && (
                    <div className={`mt-3 pt-3 border-t border-dark-border flex items-center justify-center gap-2 font-bold ${getTimerColor(timeLeft, deadlineMinutes)}`}>
                        <ClockIcon className="w-4 h-4" />
                        <span className="text-sm">
                            {timeLeft > 0 ? `Tempo: ${formatTime(timeLeft)}` : 'Prazo Esgotado!'}
                        </span>
                    </div>
                )}

                {leadStage && !['Novos Leads', 'Finalizados', 'Remanejados'].includes(leadStage.name) && (
                    <div className="mt-4 pt-4 border-t border-dark-border space-y-3 animate-fade-in">
                        {lead.leadPhone && (
                            <div className="flex items-center justify-between gap-2 text-sm text-dark-secondary pb-3 border-b border-dark-border/50">
                                <div className="flex items-center gap-2">
                                    <PhoneIcon className="w-4 h-4" />
                                    <span className="font-medium text-dark-text">{lead.leadPhone}</span>
                                </div>
                                <button 
                                    onClick={handleCopyPhone}
                                    className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md transition-colors ${
                                        isCopied 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-dark-border/50 hover:bg-dark-border'
                                    }`}
                                >
                                    {isCopied ? <CheckIcon className="w-3 h-3"/> : <ClipboardIcon className="w-3 h-3" />}
                                    {isCopied ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                        )}
                        
                        <div className="space-y-4 pt-2">
                            <DetailItem icon={<CarIcon className="w-4 h-4" />} label="Veículo de Interesse" value={lead.interestVehicle} />
                            
                            {lead.details && Object.entries(lead.details).map(([key, value]) => {
                                if (!value || (typeof value !== 'string' && typeof value !== 'number')) return null;
                                const config = detailConfig[key];
                                const label = config ? config.label : formatKeyToLabel(key);
                                const IconComponent = config ? config.icon : DocumentTextIcon;
                                return <DetailItem key={key} icon={<IconComponent className="w-4 h-4" />} label={label} value={String(value)} />;
                            })}
                        </div>

                        <div className="mt-4 pt-4 border-t border-dark-border">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFeedbackOpen(!isFeedbackOpen);
                                    if (showStatusButtons) setShowStatusButtons(false);
                                }}
                                className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-dark-border/50 hover:bg-dark-border transition-colors"
                            >
                                <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />
                                {isFeedbackOpen ? 'Fechar Feedback' : 'Feedback'}
                            </button>

                            {isFeedbackOpen && (
                                <form onSubmit={handleSubmitFeedback} className="mt-3 space-y-3 animate-fade-in" onClick={e => e.stopPropagation()}>
                                    <div>
                                        <textarea
                                            value={feedbackText}
                                            onChange={(e) => setFeedbackText(e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 text-sm bg-dark-background border border-dark-border rounded-md focus:ring-dark-primary focus:border-dark-primary"
                                            placeholder="Digite o feedback do atendimento..."
                                            required
                                        />
                                    </div>
                                    
                                    <div>
                                        <label htmlFor={`image-upload-${lead.id}`} className="w-full cursor-pointer text-center bg-dark-background hover:bg-dark-border/50 border border-dark-border text-dark-text font-medium py-2 px-3 rounded-md transition-colors text-sm flex items-center justify-center gap-2">
                                            <UploadIcon className="w-4 h-4"/>
                                            <span>Adicionar Imagens</span>
                                        </label>
                                        <input id={`image-upload-${lead.id}`} type="file" multiple className="sr-only" onChange={handleImageChange} accept="image/*" />
                                    </div>

                                    {feedbackImages.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2">
                                            {feedbackImages.map((imgSrc, index) => (
                                                <div key={index} className="relative group">
                                                    <img src={imgSrc} alt={`Preview ${index}`} className="w-full h-16 object-cover rounded-md" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <XIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-end gap-2">
                                         <button 
                                            type="submit"
                                            disabled={!feedbackText.trim() || isSubmitting}
                                            className="flex items-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-dark-primary text-dark-background hover:opacity-90 transition-opacity disabled:opacity-50"
                                         >
                                            {isSubmitting ? 'Enviando...' : 'Enviar Feedback'}
                                        </button>
                                    </div>
                                </form>
                            )}
                            
                            {showStatusButtons && (
                                <div className="mt-4 pt-3 border-t border-dark-border/50 space-y-2 animate-fade-in" onClick={e => e.stopPropagation()}>
                                    <h5 className="text-center text-xs font-bold uppercase text-dark-secondary pb-2">Qual status do atendimento?</h5>
                                     {actionableStages.map(stage => {
                                        if (stage.name === 'Finalizados') {
                                            return (
                                                <React.Fragment key="finalizados-fragment">
                                                    <button
                                                        onClick={(e) => handleStatusUpdate(e, 'Finalizados', { outcome: 'convertido' })}
                                                        className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                                    >
                                                        <CheckIcon className="w-4 h-4" />
                                                        Lead Convertido
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleStatusUpdate(e, 'Finalizados', { outcome: 'nao_convertido' })}
                                                        className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                    >
                                                        <XIcon className="w-4 h-4" />
                                                        Lead Não Convertido
                                                    </button>
                                                </React.Fragment>
                                            );
                                        }
                                        if (stage.name === 'Agendado') {
                                            return (
                                                <button
                                                    key={stage.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const today = new Date();
                                                        const defaultAppointmentTime = new Date(today.getTime() + 60 * 60 * 1000);
                                                        setAppointmentDate(defaultAppointmentTime.toISOString().split('T')[0]);
                                                        setAppointmentTime(defaultAppointmentTime.toTimeString().split(' ')[0].substring(0, 5));
                                                        setIsAppointmentModalOpen(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                >
                                                    <CalendarIcon className="w-4 h-4" />
                                                    Agendamento
                                                </button>
                                            );
                                        }
                                        // For other stages like "Segunda Tentativa" or custom stages
                                        return (
                                            <button
                                                key={stage.id}
                                                onClick={(e) => handleStatusUpdate(e, stage.name)}
                                                className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                            >
                                                <ArrowRightIcon className="w-4 h-4" />
                                                {stage.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {lead.feedback && lead.feedback.length > 0 && !isFeedbackOpen && !showStatusButtons && (
                                <div className="mt-4 pt-3 border-t border-dark-border/50 space-y-3">
                                    <h5 className="text-xs font-bold uppercase text-dark-secondary">Histórico de Feedback</h5>
                                    {lead.feedback.slice(-2).reverse().map((fb, index) => (
                                        <div key={index} className="p-2 bg-dark-background/50 rounded-md border border-dark-border/50 text-xs">
                                            <p className="whitespace-pre-wrap text-dark-secondary">{fb.text}</p>
                                            {fb.images && fb.images.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {fb.images.map((img, i) => (
                                                        <a href={img} key={i} target="_blank" rel="noopener noreferrer" className="block w-10 h-10">
                                                            <img src={img} alt="feedback" className="w-full h-full object-cover rounded"/>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-right text-dark-secondary/70 mt-1 text-[10px]">{new Date(fb.createdAt).toLocaleString('pt-BR')}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            <Modal isOpen={isAppointmentModalOpen} onClose={() => setIsAppointmentModalOpen(false)}>
                <form onSubmit={handleConfirmAppointment} className="space-y-4" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold text-center">Agendar Atendimento</h2>
                    <p className="text-center text-dark-secondary">Selecione a data e hora para o lead <strong className="text-dark-text">{lead.leadName}</strong>.</p>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div>
                            <label htmlFor={`appointmentDate-${lead.id}`} className="block text-sm font-medium text-dark-secondary mb-1">Data</label>
                            <input type="date" id={`appointmentDate-${lead.id}`} value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} required className="input-style" min={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div>
                            <label htmlFor={`appointmentTime-${lead.id}`} className="block text-sm font-medium text-dark-secondary mb-1">Hora</label>
                            <input type="time" id={`appointmentTime-${lead.id}`} value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} required className="input-style" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsAppointmentModalOpen(false)} className="px-4 py-2 rounded-md bg-dark-border/50 hover:bg-dark-border transition-colors font-bold">Cancelar</button>
                        <button type="submit" className="px-4 py-2 rounded-md bg-dark-primary text-dark-background font-bold hover:opacity-90">Confirmar Agendamento</button>
                    </div>
                     <style>{`
                        .input-style { width: 100%; padding: 0.5rem 0.75rem; background-color: #0A0F1E; border: 1px solid #243049; border-radius: 0.375rem; color: #E0E0E0; }
                        .input-style:focus { outline: none; box-shadow: 0 0 0 2px #00D1FF; }
                        .input-style::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
                      `}</style>
                </form>
            </Modal>
            
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)}>
                <div className="p-2">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-dark-background border border-dark-border flex items-center justify-center">
                            <UserCircleIcon className="w-8 h-8 text-dark-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-dark-text">{lead.leadName}</h2>
                            <p className="text-sm text-dark-secondary">Detalhes do Lead</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <h3 className="text-lg font-semibold text-dark-text border-b border-dark-border pb-2 mb-3">Informações do Lead</h3>
                        <div className="space-y-3">
                            {lead.leadPhone && (
                                <div className="flex items-center justify-between gap-2 text-sm text-dark-secondary">
                                    <div className="flex items-center gap-3">
                                        <PhoneIcon className="w-4 h-4 text-dark-secondary flex-shrink-0" />
                                        <span className="font-medium text-dark-text">{lead.leadPhone}</span>
                                    </div>
                                    <button onClick={handleCopyPhone} className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md transition-colors ${ isCopied ? 'bg-green-500/20 text-green-400' : 'bg-dark-border/50 hover:bg-dark-border' }`}>
                                        {isCopied ? <CheckIcon className="w-3 h-3"/> : <ClipboardIcon className="w-3 h-3" />}
                                        {isCopied ? 'Copiado!' : 'Copiar'}
                                    </button>
                                </div>
                            )}
                             {leadStage?.name === 'Agendado' && appointmentTimestamp && (
                                <DetailItem icon={<CalendarIcon className="w-4 h-4"/>} label="Agendamento" value={formattedDateTime}/>
                            )}
                            <DetailItem icon={<CarIcon className="w-4 h-4" />} label="Veículo de Interesse" value={lead.interestVehicle} />
                            {lead.details && Object.entries(lead.details).map(([key, value]) => {
                                if (!value || (typeof value !== 'string' && typeof value !== 'number') || key.startsWith('reassigned_') || key === 'appointment_date') return null;
                                const config = detailConfig[key];
                                const label = config ? config.label : formatKeyToLabel(key);
                                const IconComponent = config ? config.icon : DocumentTextIcon;
                                return <DetailItem key={key} icon={<IconComponent className="w-4 h-4" />} label={label} value={String(value)} />;
                            })}
                        </div>

                        {lead.feedback && lead.feedback.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-dark-border">
                                <h3 className="text-lg font-semibold text-dark-text mb-3">Histórico de Feedback</h3>
                                <div className="space-y-3">
                                    {lead.feedback.slice().reverse().map((fb, index) => (
                                        <div key={index} className={`p-3 bg-dark-background/50 rounded-md border ${isFinalized ? (lead.outcome === 'convertido' ? 'border-green-500/60' : 'border-red-500/60') : 'border-dark-border/50'}`}>
                                            <p className="whitespace-pre-wrap text-sm text-dark-text">{fb.text}</p>
                                            {fb.images && fb.images.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {fb.images.map((img, i) => (
                                                        <button onClick={() => setExpandedImageUrl(img)} key={i} className="block w-16 h-16 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-dark-primary">
                                                            <img src={img} alt="feedback" className="w-full h-full object-cover"/>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-right text-dark-secondary/70 mt-2 text-[10px]">{new Date(fb.createdAt).toLocaleString('pt-BR')}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {isManagerView && onReassign && (
                        <div className="mt-6 pt-4 border-t border-dark-border">
                             <button
                                onClick={handleReassignClick}
                                className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 px-3 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                            >
                                <SwitchHorizontalIcon className="w-4 h-4" />
                                Remanejar Lead
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {expandedImageUrl && (
                <ImageLightbox
                    imageUrl={expandedImageUrl}
                    onClose={() => setExpandedImageUrl(null)}
                />
            )}
        </>
    );
};

export default LeadCard;