'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Clock3,
  Mail,
  MessageSquareText,
  Phone,
  RadioTower,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { Input } from './ui/input';
import { StatusSelect } from './ui/status-select';
import { PageTitle } from './ui/typography';

type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Closed';

type AgentLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
  page_url: string;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
};

const statuses: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Closed'];

const previewLeads = (): AgentLead[] => {
  const now = Date.now();
  return [
    {
      id: 'preview-lead-1',
      name: 'Ishara Jayasinghe',
      email: 'ishara@lotus.example',
      phone: '+94 77 555 0301',
      message: 'We need a mobile-friendly booking site for our wellness studio.',
      source: 'Website assistant',
      page_url: 'https://infonits.example/services',
      status: 'New',
      created_at: new Date(now - 18 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 18 * 60 * 1000).toISOString(),
    },
    {
      id: 'preview-lead-2',
      name: 'Ethan Brown',
      email: 'ethan@northstar.example',
      phone: '+61 4 5555 0302',
      message: 'Can your team redesign our customer dashboard this quarter?',
      source: 'Pricing page',
      page_url: 'https://infonits.example/pricing',
      status: 'Contacted',
      created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'preview-lead-3',
      name: 'Sofia Müller',
      email: 'sofia@lumen.example',
      phone: '+41 79 555 0303',
      message: 'Looking for a long-term product design and development partner.',
      source: 'Contact form',
      page_url: 'https://infonits.example/contact',
      status: 'Qualified',
      created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function AgentLeads({ preview = false }: { preview?: boolean }) {
  const [leads, setLeads] = useState<AgentLead[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | LeadStatus>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setRefreshing(true);
      if (preview) {
        setLeads(previewLeads());
        setUnavailable(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const { data, error } = await browserClient()
        .from('agent_leads')
        .select('id,name,email,phone,message,source,page_url,status,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        setUnavailable(true);
      } else {
        setUnavailable(false);
        setLeads((data ?? []) as AgentLead[]);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [preview],
  );

  useEffect(() => {
    void load(true);
    if (preview) return;
    const timer = window.setInterval(() => void load(true), 30_000);
    const onFocus = () => void load(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load, preview]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = filter === 'All' || lead.status === filter;
      const matchesSearch =
        !needle ||
        [lead.name, lead.email, lead.phone, lead.message, lead.source].some((value) =>
          value.toLowerCase().includes(needle),
        );
      return matchesStatus && matchesSearch;
    });
  }, [filter, leads, search]);

  const newCount = leads.filter((lead) => lead.status === 'New').length;
  const qualifiedCount = leads.filter((lead) => lead.status === 'Qualified').length;

  async function changeStatus(id: string, status: LeadStatus) {
    const before = leads;
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
    if (preview) return;
    const { error } = await browserClient().from('agent_leads').update({ status }).eq('id', id);
    if (error) setLeads(before);
  }

  return (
    <>
      <section className="local-titlebar agent-leads-titlebar">
        <div>
          <span className="local-eyebrow">SALES INBOX</span>
          <PageTitle>Agent leads</PageTitle>
          <p>Monitor enquiries captured by the infonits.io agent plugin.</p>
        </div>
        <div className="local-actions">
          <button
            className="button button-outline"
            onClick={() => void load()}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} /> Refresh
          </button>
        </div>
      </section>

      <section className="agent-lead-metrics" aria-label="Lead totals">
        <article>
          <span>
            <RadioTower size={18} />
          </span>
          <div>
            <small>Total leads</small>
            <strong>{leads.length}</strong>
          </div>
        </article>
        <article className="new">
          <span>
            <Clock3 size={18} />
          </span>
          <div>
            <small>New</small>
            <strong>{newCount}</strong>
          </div>
        </article>
        <article className="qualified">
          <span>
            <ArrowUpRight size={18} />
          </span>
          <div>
            <small>Qualified</small>
            <strong>{qualifiedCount}</strong>
          </div>
        </article>
      </section>

      <section className="office-panel agent-leads-panel">
        <div className="office-toolbar agent-leads-toolbar">
          <label className="office-search">
            <Search size={17} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search leads"
            />
          </label>
          <div className="invoice-filter-chips">
            {(['All', ...statuses] as const).map((status) => (
              <button
                key={status}
                className={filter === status ? 'active' : ''}
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <span>{visible.length} leads</span>
        </div>

        {unavailable ? (
          <div className="agent-leads-setup">
            <RadioTower size={26} />
            <strong>Lead connection is ready for setup</strong>
            <p>Apply the agent leads migration and add the webhook environment variables.</p>
            <code>POST /api/agent-leads</code>
          </div>
        ) : loading ? (
          <div className="office-loading">Loading agent leads…</div>
        ) : !visible.length ? (
          <div className="agent-leads-empty">
            <MessageSquareText size={25} />
            <strong>{leads.length ? 'No matching leads' : 'Waiting for the first lead'}</strong>
            <p>New enquiries from the infonits.io agent will appear here automatically.</p>
          </div>
        ) : (
          <div className="agent-lead-grid">
            {visible.map((lead) => (
              <article className="agent-lead-card" key={lead.id}>
                <div className="agent-lead-avatar">
                  <UserRound size={19} />
                </div>
                <div className="agent-lead-identity">
                  <strong>{lead.name || 'Website visitor'}</strong>
                  <small>
                    {lead.source || 'infonits.io agent'} · {relativeTime(lead.created_at)}
                  </small>
                </div>
                <StatusSelect
                  className={`agent-lead-status ${lead.status.toLowerCase()}`}
                  aria-label={`Status for ${lead.name || 'website visitor'}`}
                  value={lead.status}
                  onChange={(event) => void changeStatus(lead.id, event.target.value as LeadStatus)}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </StatusSelect>
                {lead.message ? <p>{lead.message}</p> : null}
                <div className="agent-lead-contact">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`}>
                      <Mail size={15} /> {lead.email}
                    </a>
                  ) : null}
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`}>
                      <Phone size={15} /> {lead.phone}
                    </a>
                  ) : null}
                  {lead.page_url ? (
                    <a href={lead.page_url} target="_blank" rel="noreferrer">
                      <ArrowUpRight size={15} /> Source page
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
