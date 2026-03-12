import type { SavedScreener, ScreenerFilterCondition, ScreenerSortField } from '@marketmind/types';
import { Box, Flex, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw, LuSave } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { useScreener } from '../../hooks/useScreener';
import { useScreenerStore } from '../../store/screenerStore';
import {
  Button,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Select,
  type SelectOption,
} from '@renderer/components/ui';
import { SCREENER_INTERVAL_OPTIONS } from './constants';
import { FilterBuilder } from './FilterBuilder';
import { FilterChip } from './FilterChip';
import { PresetBar } from './PresetBar';
import { SaveScreenerDialog } from './SaveScreenerDialog';
import { SavedScreenersList } from './SavedScreenersList';
import { ScreenerResultsTable } from './ScreenerResultsTable';

const ASSET_CLASS_OPTIONS: SelectOption[] = [
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'STOCKS', label: 'Stocks' },
];

const MARKET_TYPE_OPTIONS: SelectOption[] = [
  { value: 'SPOT', label: 'Spot' },
  { value: 'FUTURES', label: 'Futures' },
];

export const ScreenerModal = memo(({ onSymbolClick }: { onSymbolClick?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void }) => {
  const { t } = useTranslation();
  const [isSaveOpen, setIsSaveOpen] = useState(false);

  const {
    isScreenerOpen,
    setScreenerOpen,
    activePresetId,
    setActivePresetId,
    customFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    setFilters,
    assetClass,
    setAssetClass,
    marketType,
    setMarketType,
    interval,
    setInterval,
    sortBy,
    sortDirection,
    toggleSort,
  } = useScreenerStore(
    useShallow((s) => ({
      isScreenerOpen: s.isScreenerOpen,
      setScreenerOpen: s.setScreenerOpen,
      activePresetId: s.activePresetId,
      setActivePresetId: s.setActivePresetId,
      customFilters: s.customFilters,
      addFilter: s.addFilter,
      updateFilter: s.updateFilter,
      removeFilter: s.removeFilter,
      clearFilters: s.clearFilters,
      setFilters: s.setFilters,
      assetClass: s.assetClass,
      setAssetClass: s.setAssetClass,
      marketType: s.marketType,
      setMarketType: s.setMarketType,
      interval: s.interval,
      setInterval: s.setInterval,
      sortBy: s.sortBy,
      sortDirection: s.sortDirection,
      toggleSort: s.toggleSort,
    }))
  );

  const {
    results,
    isLoading,
    isFetching,
    error,
    refetch,
    presets,
    indicators,
    savedScreeners,
    saveScreener,
    deleteScreener,
    isSaving,
    isDeleting,
  } = useScreener();

  const handleClose = useCallback(() => setScreenerOpen(false), [setScreenerOpen]);

  const handlePresetSelect = useCallback((id: string | null) => {
    setActivePresetId(id);
    if (id !== null) setFilters([]);
  }, [setActivePresetId, setFilters]);

  const handleSort = useCallback((key: string) => {
    toggleSort(key as ScreenerSortField);
  }, [toggleSort]);

  const handleLoadSaved = useCallback((filters: ScreenerFilterCondition[]) => {
    setFilters(filters);
    setActivePresetId(null);
  }, [setFilters, setActivePresetId]);

  const handleSave = useCallback(async (name: string) => {
    await saveScreener(name);
  }, [saveScreener]);

  const handleOpenChange = (e: { open: boolean }) => {
    if (!e.open) handleClose();
  };

  const typedSavedScreeners = useMemo(
    () => (savedScreeners as SavedScreener[]) ?? [],
    [savedScreeners],
  );

  return (
    <>
      <DialogRoot open={isScreenerOpen} onOpenChange={handleOpenChange} size="xl">
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent maxH="90vh" maxW="1200px" w="95vw">
            <DialogHeader px={4} pt={4}>
              <Flex justify="space-between" align="center" w="100%">
                <DialogTitle fontSize="md">{t('screener.title')}</DialogTitle>
                <HStack gap={2}>
                  <Select
                    size="xs"
                    value={assetClass}
                    options={ASSET_CLASS_OPTIONS}
                    onChange={(v) => setAssetClass(v as typeof assetClass)}
                    minWidth="90px"
                  />
                  <Select
                    size="xs"
                    value={marketType}
                    options={MARKET_TYPE_OPTIONS}
                    onChange={(v) => setMarketType(v as typeof marketType)}
                    minWidth="90px"
                  />
                  <Select
                    size="xs"
                    value={interval}
                    options={SCREENER_INTERVAL_OPTIONS}
                    onChange={(v) => setInterval(v as typeof interval)}
                    minWidth="70px"
                  />
                  <DialogCloseTrigger position="static" />
                </HStack>
              </Flex>
            </DialogHeader>

            <DialogBody px={4} py={3} overflowY="auto">
              <Stack gap={3}>
                <PresetBar
                  presets={presets}
                  activePresetId={activePresetId}
                  onSelectPreset={handlePresetSelect}
                />

                {activePresetId === null && (
                  <>
                    <FilterBuilder
                      filters={customFilters}
                      indicators={indicators}
                      onAdd={addFilter}
                      onUpdate={updateFilter}
                      onRemove={removeFilter}
                    />
                    <FilterChip
                      filters={customFilters}
                      onRemove={removeFilter}
                      onClearAll={clearFilters}
                    />
                  </>
                )}

                <SavedScreenersList
                  savedScreeners={typedSavedScreeners}
                  onLoad={handleLoadSaved}
                  onDelete={deleteScreener}
                  isDeleting={isDeleting}
                />

                {error && (
                  <Box p={3} bg="red.subtle" borderRadius="md">
                    <Text color="red.fg" fontSize="sm">{t('screener.error')}</Text>
                  </Box>
                )}

                {isLoading ? (
                  <Flex justify="center" py={8}>
                    <Spinner size="lg" />
                  </Flex>
                ) : results ? (
                  <ScreenerResultsTable
                    results={results.results}
                    sortKey={sortBy}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onSymbolClick={onSymbolClick ? (sym) => onSymbolClick(sym) : undefined}
                  />
                ) : null}
              </Stack>
            </DialogBody>

            <DialogFooter px={4} pb={3}>
              <Flex justify="space-between" align="center" w="100%">
                <HStack gap={2}>
                  {results && (
                    <Text fontSize="2xs" color="fg.muted">
                      {t('screener.footer.results', {
                        matched: results.totalMatched,
                        scanned: results.totalSymbolsScanned,
                        time: results.executionTimeMs,
                      })}
                    </Text>
                  )}
                </HStack>
                <HStack gap={2}>
                  <Button
                    size="2xs"
                    variant="ghost"
                    onClick={() => refetch()}
                    disabled={isFetching}
                  >
                    <LuRefreshCw />
                    {t('screener.actions.refresh')}
                  </Button>
                  <Button
                    size="2xs"
                    variant="outline"
                    onClick={() => setIsSaveOpen(true)}
                    disabled={customFilters.length === 0 && activePresetId === null}
                  >
                    <LuSave />
                    {t('screener.actions.save')}
                  </Button>
                </HStack>
              </Flex>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      <SaveScreenerDialog
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        onSave={handleSave}
        isLoading={isSaving}
      />
    </>
  );
});

ScreenerModal.displayName = 'ScreenerModal';
