import { ModelTemplate } from '../utils/types';
import ReactMarkdown from 'react-markdown';

interface TemplateCardProps {
  template: ModelTemplate;
  onSelect: (template: ModelTemplate) => void;
  isSelected: boolean;
  delay?: number;
}

const TemplateCard = ({ template, onSelect, isSelected, delay = 0 }: TemplateCardProps) => {
  // Get the correct icon based on template type
  const getTemplateIcon = () => {
    switch (template.type) {
      case 'simple':
        return '✨';
      case 'standard':
        return '📊';
      case 'cameroon':
        return '🌍';
      case 'korea':
        return '🇰🇷';
      default:
        return '📄';
    }
  };

  return (
    <div
      className={`card transition-all duration-300 h-full flex flex-col ${
        isSelected
          ? 'border-2 border-primary ring-2 ring-primary/30 transform scale-[1.02]'
          : 'hover:shadow-lg border border-midgray/20'
      } animate-fadeInUp`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-2">{getTemplateIcon()}</span>
        <h3 className="text-xl font-semibold">{template.name}</h3>
      </div>
      
      <p className="text-sm mb-4 text-darkgray/80">{template.shortDescription}</p>
      
      <div className="mb-4 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">Sectors:</span> {template.sectors.length}
          </div>
          <div>
            <span className="font-medium">Factors:</span> {template.factors.length}
          </div>
          <div>
            <span className="font-medium">Households:</span> {template.households.length}
          </div>
          <div>
            <span className="font-medium">Government:</span> {template.details.hasGovernment ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
      
      <div className="text-sm bg-neutral p-3 rounded-md mb-4 overflow-y-auto flex-grow">
        <ReactMarkdown className="prose prose-sm max-w-none">
          {`**${template.name}**\n\n${template.details.description}`}
        </ReactMarkdown>
      </div>
      
      <button 
        onClick={() => onSelect(template)} 
        className={`btn ${isSelected ? 'btn-secondary' : 'btn-primary'} w-full mt-auto`}
      >
        {isSelected ? 'Selected' : 'Choose Template'}
      </button>
    </div>
  );
};

export default TemplateCard;