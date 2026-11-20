/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Chat Contact Selector & New Conversation Modal
 * Allows searching, filtering, and selecting Google Workspace colleagues,
 * client directory contacts, or entering any email/contact to start a new space.
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  UserPlus,
  MessageSquare,
  Users,
  Briefcase,
  Mail,
  Circle,
  Plus,
  UserCheck,
} from 'lucide-react';
import { googleChatApi, ChatUser } from '../services/googleChatApi';

interface GoogleChatContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: ChatUser) => void;
}

export const GoogleChatContactModal: React.FC<GoogleChatContactModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
}) => {
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'colleagues' | 'clients' | 'online'>('all');
  const [customInput, setCustomInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      setSearchQuery('');
      setCustomInput('');
    }
  }, [isOpen]);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const list = await googleChatApi.listContacts();
      setContacts(list);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      c.displayName.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q);

    if (!matchesQuery) return false;

    if (activeFilter === 'online') return !!c.isOnline;
    if (activeFilter === 'colleagues') return c.role?.includes('Photographer') || c.role?.includes('Director') || c.role?.includes('Retoucher') || c.role?.includes('Producer');
    if (activeFilter === 'clients') return c.role?.includes('Client');
    return true;
  });

  const handleStartCustomChat = () => {
    const raw = customInput.trim();
    if (!raw) return;

    const isEmail = raw.includes('@');
    const newContact: ChatUser = {
      name: `users/${Date.now()}`,
      displayName: isEmail ? raw.split('@')[0].replace(/[._]/g, ' ') : raw,
      email: isEmail ? raw : `${raw.toLowerCase().replace(/\s+/g, '.')}@workspace.studio`,
      role: 'Direct Contact',
      isOnline: true,
    };

    onSelectContact(newContact);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div
        className="w-full max-w-lg rounded-3xl shadow-2xl border p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150 max-h-[85vh]"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">New Google Chat Conversation</h3>
              <p className="text-[11px] opacity-65">Search contacts or start a direct message</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts by name, email, or role..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:border-sky-500 focus:outline-none transition-all"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All Contacts', icon: Users },
            { id: 'colleagues', label: 'Studio Team', icon: Briefcase },
            { id: 'clients', label: 'Clients', icon: Mail },
            { id: 'online', label: 'Online Now', icon: Circle },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 shrink-0 border ${
                  active
                    ? 'bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent opacity-65 hover:opacity-100'
                }`}
              >
                <Icon className={`w-3 h-3 ${tab.id === 'online' ? 'fill-emerald-500 text-emerald-500' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-48 max-h-68 pr-1">
          {filteredContacts.map((contact) => (
            <div
              key={contact.name}
              className="p-2.5 rounded-2xl border hover:bg-black/5 dark:hover:bg-white/5 transition-all flex items-center justify-between group"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1074B1] to-[#52B197] text-white flex items-center justify-center font-bold text-xs shrink-0 relative shadow-2xs">
                  {contact.displayName[0]?.toUpperCase() || 'U'}
                  {contact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-xs truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {contact.displayName}
                  </div>
                  <div className="text-[11px] opacity-65 truncate font-mono">{contact.email}</div>
                  {contact.role && (
                    <div className="text-[10px] opacity-50 truncate mt-0.5">{contact.role}</div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  onSelectContact(contact);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-transform shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            </div>
          ))}

          {filteredContacts.length === 0 && (
            <div className="text-center py-8 opacity-60 text-xs">
              No contacts found matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Quick Custom Contact Input */}
        <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--theme-border)' }}>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartCustomChat();
            }}
            placeholder="Type any colleague or client email to chat..."
            className="flex-1 px-3 py-1.5 text-xs rounded-xl border focus:border-sky-500 focus:outline-none"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          />
          <button
            onClick={handleStartCustomChat}
            disabled={!customInput.trim()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Start</span>
          </button>
        </div>
      </div>
    </div>
  );
};
