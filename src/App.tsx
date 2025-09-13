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
  
  // Store just the IDs to track selections across pages
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<number[]>([]);
  
  const op = useRef<OverlayPanel>(null);
  const toast = useRef<Toast>(null);
  // Get artwork data from API for each page
  const fetchArtworks = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.artic.edu/api/v1/artworks?page=${page}`);
      const data: ApiResponse = await response.json();
      
      // Just show current page data
      setArtworks(data.data);
      
      setTotalRecords(data.pagination.total);
      setCurrentPage(data.pagination.current_page);
    } catch {
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

  // Load first page when app starts
  useEffect(() => {
    fetchArtworks(1);
  }, []);

  // When user changes page
  const onPageChange = (event: { page: number, rows: number }) => {
    const page = event.page + 1; // PrimeReact paginator is 0-based, API is 1-based
    fetchArtworks(page);
  };
  
  // Show selected rows when page changes
  useEffect(() => {
    if (artworks.length > 0) {
      // Find which rows should be checked
      const currentPageSelectedArtworks = artworks.filter(artwork => 
        selectedRows[artwork.id] === true
      );
      
      setSelectedArtworks(currentPageSelectedArtworks);
    }
  }, [artworks, selectedRows, currentPage, selectedArtworkIds]);

  // When user checks or unchecks rows
  const onSelectionChange = (e: { value: Artwork[] }) => {
    const selectedItems = e.value;
    setSelectedArtworks(selectedItems);
    
    // Keep track of selections
    const newSelectedRows = { ...selectedRows };
    
    // Update selection state for each row
    artworks.forEach(artwork => {
      const isSelected = selectedItems.some(item => item.id === artwork.id);
      newSelectedRows[artwork.id] = isSelected;
    });
    
    // Get all selected IDs
    const newSelectedIds = Object.entries(newSelectedRows)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => parseInt(id));
    setSelectedArtworkIds(newSelectedIds);
    
    setSelectedRows(newSelectedRows);
  };

  // When user enters a number in the overlay
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

    // Start fresh
    const newSelectedRows: Record<number, boolean> = {};
    const newSelectedIds: number[] = [];
    
    // Select rows on current page first
    const currentPageCount = Math.min(rowsToSelect, artworks.length);
    
    // Check the rows
    artworks.forEach((artwork, index) => {
      if (index < currentPageCount) {
        newSelectedRows[artwork.id] = true;
        newSelectedIds.push(artwork.id);
      }
    });

    // If we need more rows, get them from next pages
    let remainingToSelect = rowsToSelect - currentPageCount;
    let nextPage = currentPage + 1;

    while (remainingToSelect > 0) {
      try {
        setLoading(true);
        const response = await fetch(`https://api.artic.edu/api/v1/artworks?page=${nextPage}`);
        const data: ApiResponse = await response.json();
        
        if (!data.data || data.data.length === 0) {
          break; // No more data available
        }
        
        const nextPageArtworks = data.data;
        const nextPageSelectCount = Math.min(remainingToSelect, nextPageArtworks.length);
        
        // Select these rows too
        nextPageArtworks.slice(0, nextPageSelectCount).forEach(artwork => {
          newSelectedRows[artwork.id] = true;
          newSelectedIds.push(artwork.id);
        });
        
        remainingToSelect -= nextPageSelectCount;
        nextPage++;
      } catch {
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
    
    // Save all selections
    setSelectedRows(newSelectedRows);
    setSelectedArtworkIds(newSelectedIds);
    
    // Update what's shown on screen
    const currentPageSelectedArtworks = artworks.filter(artwork => 
      newSelectedRows[artwork.id] === true
    );
    setSelectedArtworks(currentPageSelectedArtworks);
    
    // Tell user it worked
    toast.current?.show({ 
      severity: 'success', 
      summary: 'Success', 
      detail: `Selected ${newSelectedIds.length} rows across pages`, 
      life: 3000 
    });
    
    op.current?.hide();
  };

  // Helper to check if a row is selected
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