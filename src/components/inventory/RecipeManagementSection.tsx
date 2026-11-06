import React, { useState } from 'react';
import {
  ProductRecipe,
  RecipeMaterialItem,
  InventoryItem,
  CostCenterMaster,
  ProductionProductCategory,
} from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';
import { SEED_RECIPES } from '../../data/seedRecipes';
import { SEED_COST_CENTERS } from '../../data/seedCostCenters';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  Search,
  FileSpreadsheet,
  Building2,
  Boxes,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { folioInterno } from '../../utils/folioInterno';

interface RecipeManagementSectionProps {
  recipes?: ProductRecipe[];
  inventoryItems: InventoryItem[];
  costCenters?: CostCenterMaster[];
  onUpdateRecipes?: (recipes: ProductRecipe[]) => void;
  onSelectRecipeForBudget?: (recipe: ProductRecipe) => void;
}

export const RecipeManagementSection: React.FC<RecipeManagementSectionProps> = ({
  recipes = SEED_RECIPES,
  inventoryItems,
  costCenters = SEED_COST_CENTERS,
  onUpdateRecipes,
  onSelectRecipeForBudget,
}) => {
  const [recipeList, setRecipeList] = useState<ProductRecipe[]>(recipes);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedRecipe, setSelectedRecipe] = useState<ProductRecipe | null>(recipeList[0] || null);

  // Modal State for New / Edit Recipe
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Form State
  const [recipeForm, setRecipeForm] = useState<Partial<ProductRecipe>>({
    codigo: '',
    nombre: '',
    productoTerminadoSku: '',
    categoria: 'REDES_Y_FONDEOS',
    unidadMedida: 'UNID',
    centroCostoFabricacion: costCenters[2]?.codigo || 'CC-PRD-QUELLON',
    rendimientoLoteBase: 1,
    materiales: [],
    costoManoObraDirectaEstimado: 1200000,
    costosIndirectosFabricacionEstimado: 600000,
    precioVentaSugerido: 15000000,
    tiempoFabricacionHoras: 80,
    version: '1.0',
    activa: true,
    notasTecnicas: '',
  });

  // Material item addition in form
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>(inventoryItems[0]?.id || '');
  const [cantidadInsumo, setCantidadInsumo] = useState<number>(1);
  const [mermaInsumo, setMermaInsumo] = useState<number>(2.0);

  // Synchronize state when props change
  React.useEffect(() => {
    if (recipes && recipes.length > 0) {
      setRecipeList(recipes);
      if (!selectedRecipe) setSelectedRecipe(recipes[0]);
    }
  }, [recipes]);

  const updateAndNotify = (newList: ProductRecipe[]) => {
    setRecipeList(newList);
    if (onUpdateRecipes) onUpdateRecipes(newList);
  };

  const filteredRecipes = recipeList.filter((r) => {
    const matchesSearch =
      r.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.productoTerminadoSku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || r.categoria === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecipeId(null);
    setRecipeForm({
      codigo: folioInterno('REC'),
      nombre: '',
      productoTerminadoSku: folioInterno('PROD'),
      categoria: 'REDES_Y_FONDEOS',
      unidadMedida: 'UNID',
      centroCostoFabricacion: costCenters[2]?.codigo || 'CC-PRD-QUELLON',
      rendimientoLoteBase: 1,
      materiales: [
        {
          insumoId: inventoryItems[0]?.id || 'item-01',
          insumoCodigo: inventoryItems[0]?.sku || 'MAT-01',
          insumoNombre: inventoryItems[0]?.nombre || 'Insumo Base',
          unidadMedida: inventoryItems[0]?.unidadMedida || 'UNID',
          cantidadRequerida: 4,
          mermaPorcentaje: 2.0,
          costoUnitarioPMP: inventoryItems[0]?.costoUnitarioPMP || 150000,
          costoSubtotal: (inventoryItems[0]?.costoUnitarioPMP || 150000) * 4,
        },
      ],
      costoManoObraDirectaEstimado: 1200000,
      costosIndirectosFabricacionEstimado: 550000,
      precioVentaSugerido: 12000000,
      tiempoFabricacionHoras: 72,
      version: '1.0',
      activa: true,
      notasTecnicas: 'Fórmula estándar de confección industrial según especificaciones de ingeniería.',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (recipe: ProductRecipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeForm({ ...recipe, materiales: [...recipe.materiales] });
    setIsModalOpen(true);
  };

  // Delete Recipe
  const handleDeleteRecipe = (id: string, nombre: string) => {
    if (!window.confirm(`¿Confirmas eliminar la receta técnica "${nombre}"?`)) return;
    const updated = recipeList.filter((r) => r.id !== id);
    updateAndNotify(updated);
    if (selectedRecipe?.id === id) {
      setSelectedRecipe(updated[0] || null);
    }
  };

  // Add Material to Current Form
  const handleAddMaterialToForm = () => {
    const it = inventoryItems.find((i) => i.id === selectedInsumoId);
    if (!it) return;

    const subtotal = Math.round(it.costoUnitarioPMP * cantidadInsumo * (1 + mermaInsumo / 100));
    const newItem: RecipeMaterialItem = {
      insumoId: it.id,
      insumoCodigo: it.sku,
      insumoNombre: it.nombre,
      unidadMedida: it.unidadMedida || 'UNID',
      cantidadRequerida: cantidadInsumo,
      mermaPorcentaje: mermaInsumo,
      costoUnitarioPMP: it.costoUnitarioPMP,
      costoSubtotal: subtotal,
    };

    const currentMaterials = recipeForm.materiales || [];
    setRecipeForm({
      ...recipeForm,
      materiales: [...currentMaterials, newItem],
    });
  };

  const handleRemoveMaterialFromForm = (index: number) => {
    const updated = [...(recipeForm.materiales || [])];
    updated.splice(index, 1);
    setRecipeForm({ ...recipeForm, materiales: updated });
  };

  // Save Recipe
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.codigo || !recipeForm.nombre) {
      alert('Código y Nombre de Receta son obligatorios.');
      return;
    }

    const materiales = recipeForm.materiales || [];
    const costoTotalMateriales = materiales.reduce((acc, m) => acc + m.costoSubtotal, 0);
    const mod = Number(recipeForm.costoManoObraDirectaEstimado) || 0;
    const cif = Number(recipeForm.costosIndirectosFabricacionEstimado) || 0;
    const costoTotalUnitario = costoTotalMateriales + mod + cif;
    const precioVenta = Number(recipeForm.precioVentaSugerido) || costoTotalUnitario * 1.35;
    const margenEstimadoPct =
      precioVenta > 0
        ? Number((((precioVenta - costoTotalUnitario) / precioVenta) * 100).toFixed(2))
        : 0;

    if (editingRecipeId) {
      const updated = recipeList.map((r) =>
        r.id === editingRecipeId
          ? ({
              ...r,
              ...recipeForm,
              costoTotalMateriales,
              costoTotalUnitarioFabricacion: costoTotalUnitario,
              precioVentaSugerido: precioVenta,
              margenEstimadoPct,
            } as ProductRecipe)
          : r
      );
      updateAndNotify(updated);
      setSelectedRecipe(updated.find((r) => r.id === editingRecipeId) || null);
    } else {
      const newRecipe: ProductRecipe = {
        id: `rec-${Date.now()}`,
        empresaId: 'client-mar-austral',
        codigo: recipeForm.codigo || 'REC-NEW',
        nombre: recipeForm.nombre || 'Nueva Receta',
        productoTerminadoSku: recipeForm.productoTerminadoSku || 'PROD-NEW',
        categoria: (recipeForm.categoria as ProductionProductCategory) || 'REDES_Y_FONDEOS',
        unidadMedida: recipeForm.unidadMedida || 'UNID',
        centroCostoFabricacion: recipeForm.centroCostoFabricacion || 'CC-PRD-QUELLON',
        rendimientoLoteBase: Number(recipeForm.rendimientoLoteBase) || 1,
        materiales,
        costoManoObraDirectaEstimado: mod,
        costosIndirectosFabricacionEstimado: cif,
        costoTotalMateriales,
        costoTotalUnitarioFabricacion: costoTotalUnitario,
        precioVentaSugerido: precioVenta,
        margenEstimadoPct,
        tiempoFabricacionHoras: Number(recipeForm.tiempoFabricacionHoras) || 48,
        version: recipeForm.version || '1.0',
        activa: recipeForm.activa ?? true,
        notasTecnicas: recipeForm.notasTecnicas || '',
      };
      const updated = [newRecipe, ...recipeList];
      updateAndNotify(updated);
      setSelectedRecipe(newRecipe);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Banner & Actions Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Ingeniería Fabril & Fórmulas (BOM)
              </span>
              <span className="text-slate-400 text-xs">|</span>
              <span className="text-xs text-slate-500 font-mono">
                Alimentación Automática de Presupuestos & Costeo Estándar
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>Recetas Técnicas de Fabricación (Bill of Materials)</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
              Define para cada producto fabricado su explosión exacta de materias primas (MPD), insumos críticos,
              mermas operacionales, mano de obra directa (MOD) y costos indirectos (CIF). Al presupuestar o cotizar
              un producto, la receta calcula instantáneamente su costo a precios PMP actualizados en bodega.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Receta (BOM)</span>
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Recetas Registradas</span>
            <strong className="text-lg font-black text-slate-900 font-mono">{recipeList.length} Fórmulas</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Centro de Costo Fabril</span>
            <strong className="text-lg font-black text-purple-700 font-mono">CC-PRD-QUELLON</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Margen Promedio Sugerido</span>
            <strong className="text-lg font-black text-emerald-600 font-mono">35.1%</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Integración Presupuestos</span>
            <strong className="text-lg font-black text-blue-700">100% Activa</strong>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left List, Right Detailed BOM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List: Recipes */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar receta por nombre o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'REDES_Y_FONDEOS', 'PRODUCTOS_MANUFACTURADOS'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'Todas' : cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredRecipes.map((recipe) => {
              const isSelected = selectedRecipe?.id === recipe.id;
              return (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-50/70 border-purple-500 shadow-sm ring-1 ring-purple-400'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded">
                      {recipe.codigo}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">v{recipe.version}</span>
                  </div>

                  <h4 className="font-bold text-xs text-slate-900 mt-1 line-clamp-1">{recipe.nombre}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    SKU Producto: <strong>{recipe.productoTerminadoSku}</strong>
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Costo Fabricación</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCLP(recipe.costoTotalUnitarioFabricacion)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Precio Sugerido</span>
                      <span className="font-mono font-black text-purple-700">
                        {formatCLP(recipe.precioVentaSugerido)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail: Explosión de Materiales y Costeo */}
        <div className="lg:col-span-8">
          {selectedRecipe ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              {/* Recipe Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black bg-purple-100 text-purple-900 px-2 py-0.5 rounded">
                      {selectedRecipe.codigo}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Versión {selectedRecipe.version}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {selectedRecipe.activa ? 'ACTIVA EN PLANTA' : 'INACTIVA'}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">{selectedRecipe.nombre}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Imputación Centro de Costo:{' '}
                    <strong className="text-slate-800">{selectedRecipe.centroCostoFabricacion}</strong> • Unidad:{' '}
                    <strong>{selectedRecipe.unidadMedida}</strong> • Horas estimadas:{' '}
                    <strong>{selectedRecipe.tiempoFabricacionHoras || 60} hrs</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(selectedRecipe)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Editar Receta"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteRecipe(selectedRecipe.id, selectedRecipe.nombre)}
                    className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Eliminar Receta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Technical Notes if any */}
              {selectedRecipe.notasTecnicas && (
                <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 text-xs text-purple-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Especificaciones de Fabricación:</span>
                    <p className="text-slate-700">{selectedRecipe.notasTecnicas}</p>
                  </div>
                </div>
              )}

              {/* Materials Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-purple-600" />
                    <span>Explosión de Materias Primas e Insumos Directos (MPD)</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-purple-700">
                    Subtotal MPD: {formatCLP(selectedRecipe.costoTotalMateriales)}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Código Insumo</th>
                        <th className="py-2.5 px-3">Descripción de Material</th>
                        <th className="py-2.5 px-3 text-center">Cant. Requerida</th>
                        <th className="py-2.5 px-3 text-center">Merma (%)</th>
                        <th className="py-2.5 px-3 text-right">PMP Unitario</th>
                        <th className="py-2.5 px-3 text-right">Costo Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRecipe.materiales.map((mat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{mat.insumoCodigo}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{mat.insumoNombre}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {mat.cantidadRequerida} {mat.unidadMedida}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-600">
                            {mat.mermaPorcentaje}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCLP(mat.costoUnitarioPMP)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCLP(mat.costoSubtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Manufacturing Cost Structure Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase">1. Materiales Directos (MPD)</span>
                  <div className="font-mono font-black text-slate-900 text-sm">
                    {formatCLP(selectedRecipe.costoTotalMateriales)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {selectedRecipe.materiales.length} ítems de bodega
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase">2. Mano de Obra Directa (MOD)</span>
                  <div className="font-mono font-black text-blue-700 text-sm">
                    {formatCLP(selectedRecipe.costoManoObraDirectaEstimado)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">Rederos & soldadores fabriles</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase">3. Costos Indirectos (CIF)</span>
                  <div className="font-mono font-black text-amber-700 text-sm">
                    {formatCLP(selectedRecipe.costosIndirectosFabricacionEstimado)}
                  </div>
                  <span className="text-[10px] text-slate-400 block">Amortización máquinas y energía</span>
                </div>
              </div>

              {/* Commercial Price & Profit Margin */}
              <div className="bg-purple-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
                    Costo Total de Producción (NIC 2) vs Precio Venta Sugerido
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black font-mono">
                      Costo: {formatCLP(selectedRecipe.costoTotalUnitarioFabricacion)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-purple-300" />
                    <span className="text-xl font-black font-mono text-emerald-300">
                      Venta: {formatCLP(selectedRecipe.precioVentaSugerido)}
                    </span>
                  </div>
                </div>

                <div className="text-right bg-white/10 px-3.5 py-1.5 rounded-lg border border-white/10">
                  <span className="text-[10px] text-purple-200 block font-semibold">Margen Estimado</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {selectedRecipe.margenEstimadoPct}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-sm">Selecciona una receta para inspeccionar su ficha de materiales</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Crear / Editar Receta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 my-8 max-h-[92vh] overflow-y-auto space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              {editingRecipeId ? 'Editar Receta / Ficha Técnica (BOM)' : 'Crear Nueva Receta de Fabricación (BOM)'}
            </h3>
            <p className="text-xs text-slate-500">
              Ingresa los materiales requeridos por unidad de producto terminado. Estos datos alimentarán los presupuestos.
            </p>

            <form onSubmit={handleSaveRecipe} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Código de Receta</label>
                  <input
                    type="text"
                    required
                    value={recipeForm.codigo}
                    onChange={(e) => setRecipeForm({ ...recipeForm, codigo: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Nombre del Producto a Fabricar</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Red Lobera Polietileno Reforzada 40x40m"
                    value={recipeForm.nombre}
                    onChange={(e) => setRecipeForm({ ...recipeForm, nombre: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SKU Producto Terminado</label>
                  <input
                    type="text"
                    required
                    value={recipeForm.productoTerminadoSku}
                    onChange={(e) => setRecipeForm({ ...recipeForm, productoTerminadoSku: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Centro de Costo Fabril</label>
                  <select
                    value={recipeForm.centroCostoFabricacion}
                    onChange={(e) => setRecipeForm({ ...recipeForm, centroCostoFabricacion: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  >
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.codigo}>
                        {cc.codigo} - {cc.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Horas Hombre Fabriles</label>
                  <input
                    type="number"
                    min="1"
                    value={recipeForm.tiempoFabricacionHoras}
                    onChange={(e) => setRecipeForm({ ...recipeForm, tiempoFabricacionHoras: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              {/* Add Materials Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 uppercase block text-[11px]">
                  Agregar Material / Insumo a la Receta
                </span>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <select
                      value={selectedInsumoId}
                      onChange={(e) => setSelectedInsumoId(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-semibold"
                    >
                      {inventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          [{it.sku}] {it.nombre} - PMP: {formatCLP(it.costoUnitarioPMP)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder="Cantidad"
                      value={cantidadInsumo}
                      onChange={(e) => setCantidadInsumo(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Merma %"
                      value={mermaInsumo}
                      onChange={(e) => setMermaInsumo(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={handleAddMaterialToForm}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs transition cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>

                {/* List of current materials in form */}
                <div className="space-y-1.5 pt-2">
                  {(recipeForm.materiales || []).map((mat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white p-2 rounded border border-slate-200 text-xs"
                    >
                      <div>
                        <strong className="font-mono text-purple-900">{mat.insumoCodigo}</strong> - {mat.insumoNombre}
                        <span className="text-slate-500 ml-2">
                          ({mat.cantidadRequerida} {mat.unidadMedida} • Merma: {mat.mermaPorcentaje}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-800">{formatCLP(mat.costoSubtotal)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialFromForm(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MOD, CIF & Suggested Price */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Costo MOD Estimado ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={recipeForm.costoManoObraDirectaEstimado}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, costoManoObraDirectaEstimado: Number(e.target.value) })
                    }
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Costo CIF Estimado ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={recipeForm.costosIndirectosFabricacionEstimado}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, costosIndirectosFabricacionEstimado: Number(e.target.value) })
                    }
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Precio Venta Sugerido ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={recipeForm.precioVentaSugerido}
                    onChange={(e) => setRecipeForm({ ...recipeForm, precioVentaSugerido: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded font-mono font-black text-purple-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notas Técnicas de Confección</label>
                <textarea
                  rows={2}
                  value={recipeForm.notasTecnicas}
                  onChange={(e) => setRecipeForm({ ...recipeForm, notasTecnicas: e.target.value })}
                  placeholder="Detalles sobre normas técnicas, tipo de enmallado o recomendaciones de soldadura..."
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow cursor-pointer transition"
                >
                  Guardar Receta BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
