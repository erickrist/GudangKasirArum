import { useState, useEffect } from 'react';

export const usePricing = (stores) => {
  // 1. State untuk mendeteksi Kasir sedang aktif di toko mana
  const [activeStoreId, setActiveStoreId] = useState(() => {
    return localStorage.getItem('kasir_active_store') || '';
  });

  // 2. Set default toko (Pusat/Toko Pertama) jika belum memilih
  useEffect(() => {
    if (stores && stores.length > 0 && !activeStoreId) {
      setActiveStoreId(stores[0].id);
      localStorage.setItem('kasir_active_store', stores[0].id);
    }
  }, [stores, activeStoreId]);

  // 3. Fungsi untuk mengganti toko aktif
  const handleStoreChange = (newStoreId, onClearCartCallback) => {
    setActiveStoreId(newStoreId);
    localStorage.setItem('kasir_active_store', newStoreId);
    
    // Panggil fungsi kosongkan keranjang jika disediakan
    if (onClearCartCallback) {
      onClearCartCallback();
    }
  };

  // 4. Fungsi Cerdas Penentu Harga Dinamis
  const getProductPrice = (product) => {
    // Ambil harga default terlebih dahulu
    const defaultPrice = Number(product.defaultPrice || product.price || 0);
    
    // Jika tidak ada toko yang dipilih, atau yang dipilih adalah pusat, kembalikan harga default
    if (!activeStoreId || activeStoreId === 'pusat') return defaultPrice;
    
    // Cek apakah produk ini punya harga khusus untuk toko yang sedang aktif
    if (product.storePrices && product.storePrices[activeStoreId]) {
      const storePrice = Number(product.storePrices[activeStoreId]);
      // Jika harga khusus lebih dari 0, gunakan harga tersebut
      if (storePrice > 0) return storePrice; 
    }
    
    return defaultPrice;
  };

  return {
    activeStoreId,
    handleStoreChange,
    getProductPrice
  };
};