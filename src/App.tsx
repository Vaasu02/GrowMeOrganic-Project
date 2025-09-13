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
  
  const op = useRef<OverlayPanel>(null);
  const toast = useRef<Toast>(null);
  // Fetch artwork data from API
  const fetchArtworks = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.artic.edu/api/v1/artworks?page=${page}`);
      const data: ApiResponse = await response.json();
      
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
    fetchArtworks(page);
  };

  // Handle row selection
  const onSelectionChange = (e: { value: Artwork[] }) => {
    const selectedItems = e.value;
    setSelectedArtworks(selectedItems);
    
    // Update selected rows map
    const newSelectedRows = { ...selectedRows };
    
    // Mark current page items as selected or not
    artworks.forEach(artwork => {
      const isSelected = selectedItems.some(item => item.id === artwork.id);
      newSelectedRows[artwork.id] = isSelected;
    });
    
    setSelectedRows(newSelectedRows);
  };

  // Select specific number of rows
  const selectRows = () => {
    if (rowsToSelect <= 0) {
      toast.current?.show({ 
        severity: 'warn', 
        summary: 'Warning', 
        detail: 'Please enter a valid number', 
        life: 3000 
      });
      return;
    }

    const count = Math.min(rowsToSelect, artworks.length);
    const newSelection = artworks.slice(0, count);
    
    // Update selected artworks
    setSelectedArtworks(prevSelected => {
      // Filter out any current page items from previous selection
      const filteredPrevious = prevSelected.filter(item => 
        !artworks.some(artwork => artwork.id === item.id)
      );
      
      return [...filteredPrevious, ...newSelection];
    });
    
    // Update selected rows map
    const newSelectedRows = { ...selectedRows };
    artworks.forEach((artwork, index) => {
      newSelectedRows[artwork.id] = index < count;
    });
    
    setSelectedRows(newSelectedRows);
    
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