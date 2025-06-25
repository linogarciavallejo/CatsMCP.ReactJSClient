import React from 'react';
import { ToolsListProps } from '../types';

const ToolsList: React.FC<ToolsListProps> = ({ tools }) => {
  if (!tools || tools.length === 0) {
    return (
      <div className="tools-section">
        <h2>Available Tools</h2>
        <p>No tools available from the connected server.</p>
      </div>
    );
  }

  return (
    <div className="tools-section">
      <h2>Available Tools ({tools.length})</h2>
      <div className="tools-list">
        {tools.map((tool, index) => (
          <div key={index} className="tool-card">
            <h4>{tool.name}</h4>
            <p>{tool.description || 'No description available'}</p>
            {tool.inputSchema && tool.inputSchema.properties && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6c757d' }}>
                Parameters: {Object.keys(tool.inputSchema.properties).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolsList;
