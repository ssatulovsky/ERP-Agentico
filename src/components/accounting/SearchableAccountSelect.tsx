import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Building, BookOpen } from 'lucide-react';
import type { HierarchicalAccountItem } from '../../types';

interface SearchableAccountSelectProps {
  value: string; // account name or code
  selectedCode?: string;
  accounts: HierarchicalAccountItem[];
  onChange: (account: HierarchicalAccountItem) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchableAccountSelect: React.FC<SearchableAccountSelectProps> = ({
  value,
  selectedCode,
  accounts,
  onChange,
  className = '',
  placeholder = 'Buscar cuenta por código o nombre...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Determinar la cuenta actualmente seleccionada
  const selectedAccount = useMemo(() => {
    return (
      accounts.find(
        (a) =>
          (selectedCode && a.codigo === selectedCode) ||
          a.nombre.toLowerCase() === (value || '').toLowerCase() ||
          a.codigo === value
      ) || null
    );
  }, [accounts, selectedCode, value]);

  // Filtrado reactivo de cuentas
  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) {
      return accounts.slice(0, 100); // Primeras 100 por defecto para velocidad
    }
    const term = searchTerm.toLowerCase().trim();
    return accounts.filter(
      (acc) =>
        acc.codigo.toLowerCase().includes(term) ||
        acc.nombre.toLowerCase().includes(term) ||
        acc.tipo.toLowerCase().includes(term) ||
        (acc.grupo && acc.grupo.toLowerCase().includes(term))
    );
  }, [accounts, searchTerm]);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mantener el índice resaltado dentro del rango al filtrar
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredAccounts]);

  const handleSelect = (account: HierarchicalAccountItem) => {
    onChange(account);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredAccounts.length - 1 ? prev + 1 : prev
      );
      scrollItemIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      scrollItemIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredAccounts[highlightedIndex]) {
        handleSelect(filteredAccounts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const scrollItemIntoView = (index: number) => {
    if (!listRef.current) return;
    const item = listRef.current.children[index] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  };

  const getTypeBadgeClass = (tipo: string) => {
    switch (tipo) {
      case 'ACTIVO':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PASIVO':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'PATRIMONIO':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'INGRESO':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'COSTO':
      case 'GASTO':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Botón trigger principal */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 60);
            }
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg hover:border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-left transition-colors cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
        }`}
        title={selectedAccount ? `${selectedAccount.codigo} - ${selectedAccount.nombre}` : 'Seleccionar cuenta'}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {selectedAccount ? (
            <>
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] shrink-0 border border-slate-200">
                {selectedAccount.codigo}
              </span>
              <span className="truncate text-slate-800 font-medium">
                {selectedAccount.nombre}
              </span>
            </>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {/* Popover flotante desplegable con filtro en tiempo real */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[340px] max-w-[460px] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Campo de búsqueda interactivo */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escriba código (ej: 1.1.02) o nombre (ej: Banco, IVA)..."
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-sans"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Contador y metadatos */}
          <div className="px-3 py-1 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              {filteredAccounts.length} cuenta{filteredAccounts.length === 1 ? '' : 's'} disponible{filteredAccounts.length === 1 ? '' : 's'}
            </span>
            <span className="font-mono text-slate-400">Use ↑ ↓ y Enter para elegir</span>
          </div>

          {/* Lista de Cuentas Filtradas */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1"
          >
            {filteredAccounts.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-400">
                <BookOpen className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                No se encontraron cuentas contables que coincidan con &quot;<span className="font-semibold">{searchTerm}</span>&quot;.
              </li>
            ) : (
              filteredAccounts.map((account, index) => {
                const isSelected = selectedAccount?.codigo === account.codigo;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={account.codigo}
                    onClick={() => handleSelect(account)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-2.5 py-2 text-xs flex items-center justify-between gap-2 rounded-lg cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-blue-50 text-blue-900'
                        : isSelected
                        ? 'bg-slate-50 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {account.codigo}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900 text-xs">
                          {account.nombre}
                        </div>
                        {account.grupo && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {account.grupo} {account.subgrupo ? `› ${account.subgrupo}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {account.requiereAuxiliarRut && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          Auxiliar
                        </span>
                      )}
                      {account.requiereCentroCosto && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          C. Costo
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getTypeBadgeClass(
                          account.tipo
                        )}`}
                      >
                        {account.tipo}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
