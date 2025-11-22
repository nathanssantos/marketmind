import { useTradingStore } from '@renderer/store/tradingStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

export const useOrderLinesRenderer = (manager: CanvasManager | null, isSimulatorActive: boolean) => {
  const orders = useTradingStore((state) => state.orders);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);

  const renderOrderLines = (): void => {
    if (!manager || !isSimulatorActive) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const { width } = dimensions;

    const activeOrders = orders.filter(
      (order) => 
        order.walletId === activeWalletId && 
        (order.status === 'active' || order.status === 'pending')
    );

    activeOrders.forEach((order) => {
      const y = manager.priceToY(order.entryPrice);
      const isLong = order.type === 'long';
      
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isLong ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.fillStyle = isLong ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      const label = `${order.type.toUpperCase()} ${order.entryPrice.toFixed(2)}`;
      const labelWidth = ctx.measureText(label).width;
      const padding = 4;
      const labelX = width - 10;
      
      ctx.fillRect(
        labelX - labelWidth - padding * 2,
        y - 10,
        labelWidth + padding * 2,
        20
      );
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, labelX - padding, y);
      
      ctx.restore();

      if (order.stopLoss) {
        const stopY = manager.priceToY(order.stopLoss);
        
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        
        ctx.beginPath();
        ctx.moveTo(0, stopY);
        ctx.lineTo(width, stopY);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const slLabel = `SL ${order.stopLoss.toFixed(2)}`;
        const slWidth = ctx.measureText(slLabel).width;
        const slX = width - 10;
        
        ctx.fillRect(
          slX - slWidth - padding * 2,
          stopY - 9,
          slWidth + padding * 2,
          18
        );
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(slLabel, slX - padding, stopY);
        
        ctx.restore();
      }

      if (order.takeProfit) {
        const tpY = manager.priceToY(order.takeProfit);
        
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        
        ctx.beginPath();
        ctx.moveTo(0, tpY);
        ctx.lineTo(width, tpY);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const tpLabel = `TP ${order.takeProfit.toFixed(2)}`;
        const tpWidth = ctx.measureText(tpLabel).width;
        const tpX = width - 10;
        
        ctx.fillRect(
          tpX - tpWidth - padding * 2,
          tpY - 9,
          tpWidth + padding * 2,
          18
        );
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tpLabel, tpX - padding, tpY);
        
        ctx.restore();
      }
    });
  };

  return { renderOrderLines };
};
