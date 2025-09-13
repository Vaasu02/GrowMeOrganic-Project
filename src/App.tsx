import { useEffect, useState, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Paginator } from 'primereact/paginator';
import { OverlayPanel } from 'primereact/overlaypanel';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';

// Import PrimeReact styles
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";

import type { Artwork, ApiResponse } from './types/artwork';

const App = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedArtworks, setSelectedArtworks] = useState<Artwork[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [rowsToSelect, setRowsToSelect] = useState<number>(0);
  
  // Instead of storing full artwork objects, we only need IDs for selection persistence
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<number[]>([]);
  
  const op = useRef<OverlayPanel>(null);
  const toast = useRef<Toast>(null);
  // Fetch artwork data from API
  const fetchArtworks = async (page: number) => {
    console.log('🚀 Fetching artworks for page:', page);
    setLoading(true);
    try {
      const response = await fetch(`https://api.artic.edu/api/v1/artworks?page=${page}`);
      const data: ApiResponse = await response.json();
      
      console.log('📦 Fetched data:', data.data.length, 'artworks');
      
      // Update the artworks for the current page only
      setArtworks(data.data);
      
      setTotalRecords(data.pagination.total);
      setCurrentPage(data.pagination.current_page);
    } catch (error) {
      console.error('Error fetching artworks:', error);
      toast.current?.show({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Failed to fetch artwork data', 
        life: 3000 
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    fetchArtworks(1);
  }, []);

  // Handle page change
  const onPageChange = (event: { page: number, rows: number }) => {
    const page = event.page + 1; // PrimeReact paginator is 0-based, API is 1-based
    console.log('📄 Page change requested to page:', page);
    console.log('🔍 Current selectedRows state:', selectedRows);
    console.log('📊 Total selected count:', Object.values(selectedRows).filter(Boolean).length);
    fetchArtworks(page);
  };
  
  // Update the DataTable selection when artworks change
  useEffect(() => {
    if (artworks.length > 0) {
      console.log('🔄 Artworks updated, applying selection state...');
      console.log('📋 Current page artworks:', artworks.length, 'items');
      console.log('🎯 Current page:', currentPage);
      
      // Filter to only include current page items that are selected
      const currentPageSelectedArtworks = artworks.filter(artwork => {
        const isSelected = selectedRows[artwork.id] === true;
        console.log(`🎨 Artwork ${artwork.id} (${artwork.title}): ${isSelected ? 'SELECTED' : 'not selected'}`);
        return isSelected;
      });
      
      console.log('✅ Selected artworks on current page:', currentPageSelectedArtworks.length);
      console.log('🆔 Selected IDs:', currentPageSelectedArtworks.map(a => a.id));
      
      setSelectedArtworks(currentPageSelectedArtworks);
    }
  }, [artworks, selectedRows, currentPage, selectedArtworkIds]);

  // Handle row selection
  const onSelectionChange = (e: { value: Artwork[] }) => {
    const selectedItems = e.value;
    console.log('👆 Manual selection change:', selectedItems.length, 'items selected');
    console.log('🆔 Manually selected IDs:', selectedItems.map(item => item.id));
    
    setSelectedArtworks(selectedItems);
    
    // Update selected rows map
    const newSelectedRows = { ...selectedRows };
    
    // Mark current page items as selected or not
    artworks.forEach(artwork => {
      const isSelected = selectedItems.some(item => item.id === artwork.id);
      newSelectedRows[artwork.id] = isSelected;
      console.log(`🔄 Updated selection for artwork ${artwork.id}: ${isSelected}`);
    });
    
    // Update the array of selected artwork IDs
    const newSelectedIds = Object.entries(newSelectedRows)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => parseInt(id));
    setSelectedArtworkIds(newSelectedIds);
    
    setSelectedRows(newSelectedRows);
    console.log('💾 Updated selectedRows state:', newSelectedRows);
    console.log('🔢 Total selected IDs:', newSelectedIds.length);
  };

  // Select specific number of rows across pages
  const selectRows = async () => {
    if (rowsToSelect <= 0) {
      toast.current?.show({ 
        severity: 'warn', 
        summary: 'Warning', 
        detail: 'Please enter a valid number', 
        life: 3000 
      });
      return;
    }

    console.log('🎯 Starting selection process for', rowsToSelect, 'rows');
    console.log('📍 Current page:', currentPage);
    console.log('📋 Current page artworks:', artworks.length);

    // Clear previous selections
    const newSelectedRows: Record<number, boolean> = {};
    const newSelectedIds: number[] = [];
    
    // Handle current page selection first
    const currentPageCount = Math.min(rowsToSelect, artworks.length);
    console.log('✅ Selecting', currentPageCount, 'rows from current page');
    
    // Mark current page items as selected
    artworks.forEach((artwork, index) => {
      if (index < currentPageCount) {
        newSelectedRows[artwork.id] = true;
        newSelectedIds.push(artwork.id);
        console.log(`🎨 Selected artwork ${artwork.id} (${artwork.title}) from current page`);
      }
    });

    // If we need more rows than available on current page, fetch and select from next pages
    let remainingToSelect = rowsToSelect - currentPageCount;
    let nextPage = currentPage + 1;
    
    console.log('🔄 Need to select', remainingToSelect, 'more rows from subsequent pages');

    while (remainingToSelect > 0) {
      try {
        console.log('🚀 Fetching page', nextPage, 'for additional selections');
        setLoading(true);
        const response = await fetch(`https://api.artic.edu/api/v1/artworks?page=${nextPage}`);
        const data: ApiResponse = await response.json();
        
        if (!data.data || data.data.length === 0) {
          console.log('❌ No more data available on page', nextPage);
          break;
        }
        
        const nextPageArtworks = data.data;
        console.log('📦 Fetched', nextPageArtworks.length, 'artworks from page', nextPage);
        
        const nextPageSelectCount = Math.min(remainingToSelect, nextPageArtworks.length);
        console.log('✅ Selecting', nextPageSelectCount, 'rows from page', nextPage);
        
        // Update selected rows map for this page
        nextPageArtworks.slice(0, nextPageSelectCount).forEach(artwork => {
          newSelectedRows[artwork.id] = true;
          newSelectedIds.push(artwork.id);
          console.log(`🎨 Selected artwork ${artwork.id} (${artwork.title}) from page ${nextPage}`);
        });
        
        remainingToSelect -= nextPageSelectCount;
        nextPage++;
      } catch (error) {
        console.error('❌ Error fetching additional artworks for selection:', error);
        toast.current?.show({ 
          severity: 'error', 
          summary: 'Error', 
          detail: 'Failed to fetch additional artwork data for selection', 
          life: 3000 
        });
        break;
      } finally {
        setLoading(false);
      }
    }
    
    // Update selected rows map and IDs
    setSelectedRows(newSelectedRows);
    setSelectedArtworkIds(newSelectedIds);
    console.log('🎯 Final selection state:', newSelectedRows);
    console.log('📊 Total selected rows:', newSelectedIds.length);
    
    // Update selected artworks for current page
    const currentPageSelectedArtworks = artworks.filter(artwork => 
      newSelectedRows[artwork.id] === true
    );
    setSelectedArtworks(currentPageSelectedArtworks);
    console.log('✅ Current page selected artworks updated:', currentPageSelectedArtworks.length);
    
    // Show success message
    toast.current?.show({ 
      severity: 'success', 
      summary: 'Success', 
      detail: `Selected ${newSelectedIds.length} rows across pages`, 
      life: 3000 
    });
    
    op.current?.hide();
  };

  // Check if a row is selected based on our tracking
  const isRowSelected = (artwork: Artwork) => {
    return !!selectedRows[artwork.id];
  };

  return (
    <div className="card p-4">
      <Toast ref={toast} />
      
      <h1 className="text-3xl font-bold mb-4">Art Institute of Chicago - Artworks</h1>
      
      <OverlayPanel ref={op} className="selection-overlay">
        <div className="p-3">
          <h3>Select Rows</h3>
          <div className="selection-input-container">
            <InputText 
              placeholder="Select rows..."
              value={rowsToSelect.toString()} 
              onChange={(e) => setRowsToSelect(parseInt(e.target.value) || 0)} 
              className="selection-input"
            />
            <div className="submit-button-container">
              <Button 
                label="submit" 
                className="submit-button" 
                onClick={selectRows} 
              />
            </div>
          </div>
        </div>
      </OverlayPanel>
      
      <DataTable 
        value={artworks} 
        selection={selectedArtworks}
        onSelectionChange={onSelectionChange}
        selectionMode="multiple"
        dataKey="id"
        loading={loading}
        rowHover
        responsiveLayout="scroll"
        emptyMessage="No artworks found"
        className="mb-4"
        rowClassName={(data) => isRowSelected(data) ? 'bg-blue-50' : ''}
      >
        <Column 
          selectionMode="multiple" 
          headerStyle={{ width: '3rem' }} 
        />
        <Column 
          field="title" 
          header={
            <div className="title-header-container">
              <i className="pi pi-chevron-down cursor-pointer" onClick={(e) => op.current?.toggle(e)}></i>
              <span>Title</span>
            </div>
          }
        />
        <Column field="place_of_origin" header="Place of Origin" />
        <Column field="artist_display" header="Artist" />
        <Column field="inscriptions" header="Inscriptions" />
        <Column field="date_start" header="Date Start" />
        <Column field="date_end" header="Date End" />
      </DataTable>
      
      <Paginator 
        first={(currentPage - 1) * 12} 
        rows={12} 
        totalRecords={totalRecords} 
        onPageChange={onPageChange}
        template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} artworks"
      />
    </div>
  );
};

export default App;